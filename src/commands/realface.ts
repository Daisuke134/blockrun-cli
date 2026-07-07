// REQ-137–143. `blockrun realface`.
import { buildRequest } from "../args/realface.js";
import { fetchJson } from "../shell/http.js";
import { payOnce } from "../shell/manual-x402.js";
import { getChain } from "../shell/wallet.js";
import { generateUrlQrPng, openQrInViewer } from "../shell/qr.js";
import { extractErrorMessage } from "../core/errors.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

const ENROLLMENT_PRICE_USD = 0.01;
const BLOCKRUN_API = "https://blockrun.ai/api";

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json);
  const { action, name, groupId, imageUrl, agent_id } = built.value;

  try {
    if (action === "init") {
      const body: Record<string, unknown> = { name };
      if (groupId) body.groupId = groupId;
      const { status, data } = await fetchJson(`${BLOCKRUN_API}/v1/realface/init`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }, 30_000);
      if (status !== 200) return fail(`init failed (${status}): ${data.error ?? JSON.stringify(data)}`, opts.json);
      const h5Link: string | undefined = data.h5_link;
      if (h5Link) {
        try {
          const qrPath = await generateUrlQrPng(h5Link, "realface-h5-qr.png");
          await openQrInViewer(qrPath);
        } catch { /* best-effort — the link is still printed */ }
      }
      return ok(
        { group_id: data.group_id, status: data.status, h5_link: h5Link, expires_in_seconds: data.expires_in_seconds },
        opts.json,
        `RealFace enrollment started.\nGroup ID: ${data.group_id}\nStatus: ${data.status}${h5Link ? `\nPhone link: ${h5Link}` : ""}`,
      );
    }

    if (action === "status") {
      const { status, data } = await fetchJson(`${BLOCKRUN_API}/v1/realface/status?groupId=${encodeURIComponent(groupId!)}`, { method: "GET" }, 30_000);
      if (status !== 200) return fail(`status failed (${status}): ${data.error ?? JSON.stringify(data)}`, opts.json);
      return ok(
        { group_id: data.group_id, status: data.status, asset_count: data.asset_count, ready_to_finalize: Boolean(data.ready_to_finalize) },
        opts.json,
        `RealFace group ${data.group_id}\nStatus: ${data.status}\nReady to finalize: ${Boolean(data.ready_to_finalize)}`,
      );
    }

    if (action === "list") {
      // Dynamic import: getWalletInfo is not part of every mocked test surface for
      // shell/wallet.js (this "list" action has no test coverage in this suite), so
      // a static named import would break unrelated tests' module mocks.
      const { getWalletInfo } = await import("../shell/wallet.js");
      const info = await getWalletInfo();
      const { status, data } = await fetchJson(`${BLOCKRUN_API}/v1/wallet/${info.address}/realfaces`, { method: "GET" }, 30_000);
      if (status !== 200) return fail(`list failed (${status}): ${data.error ?? JSON.stringify(data)}`, opts.json);
      const faces = Array.isArray(data.realfaces) ? data.realfaces : [];
      const portraits = Array.isArray(data.portraits) ? data.portraits : [];
      return ok(
        { wallet: info.address, realfaces: faces, portraits, count: faces.length + portraits.length },
        opts.json,
        `Assets for ${info.address}: ${faces.length} RealFace, ${portraits.length} Virtual Portrait`,
      );
    }

    // ---- enroll / portrait (paid, Base only) ----
    if (getChain() !== "base") {
      return fail(
        "blockrun realface enroll/portrait settles on Base only. Switch BlockRun to Base (blockrun wallet --action chain --chain base) and fund the Base wallet with USDC.",
        opts.json,
        { chain: "solana" },
      );
    }

    const gated = gatePaidCall(budget, agent_id, ENROLLMENT_PRICE_USD, opts.json);
    if (!gated.ok) return gated.outcome;

    try {
      const endpoint = action === "portrait" ? "/v1/portrait/enroll" : "/v1/realface/enroll";
      const body: Record<string, unknown> = action === "portrait"
        ? { name, image_url: imageUrl }
        : { name, image_url: imageUrl, group_id: groupId };
      const result = await payOnce({
        endpoint,
        body,
        resourceDescription: action === "portrait" ? "BlockRun Virtual Portrait enrollment" : "BlockRun RealFace enrollment",
        // REQ-220: re-validate the real 402-quoted amount against both budget
        // caps BEFORE any signature is produced.
        onQuote: (quotedUsd) => {
          const check = gated.paid.reverify(quotedUsd);
          if (!check.allowed) {
            throw new Error(check.reason ?? "Budget cap would be exceeded by the real quoted price.");
          }
        },
      });
      const billedUsd = result.billedUsd ?? ENROLLMENT_PRICE_USD;
      gated.paid.commit(result.billedUsd);
      const data = result.data as { asset_id?: string; name?: string; group_id?: string };
      if (!data.asset_id) throw new Error(`${action} response missing asset_id: ${JSON.stringify(data)}`);
      return ok(
        { asset_id: data.asset_id, name: data.name ?? name, ...(data.group_id ? { group_id: data.group_id } : {}), price_usd: billedUsd, ...(result.txHash ? { txHash: result.txHash } : {}) },
        opts.json,
        `${action} enrolled!\nAsset ID: ${data.asset_id}\nCost: $${billedUsd.toFixed(2)}`,
      );
    } finally {
      gated.paid.release();
    }
  } catch (err) {
    const msg = extractErrorMessage(err);
    return fail(msg, opts.json, { chain: getChain() });
  }
}
