// REQ-123–129, REQ-220. `blockrun image`. Base-chain generate/edit via the SDK's
// ImageClient; Solana-chain via the manual x402 flow (shell/solana-x402.ts),
// mirroring blockrun-mcp's image.ts — Base has no billed-amount in the SDK
// response (catalog estimate is billed), Solana returns the real 402-quoted
// amount, re-validated against the budget caps (REQ-220) before signing.
import { buildRequest, buildSolanaImageRequest } from "../args/image.js";
import { estimateCost } from "../core/cost/image.js";
import { extractErrorMessage } from "../core/errors.js";
import { getChain, getImageClient } from "../shell/wallet.js";
import { solanaPaidPost } from "../shell/solana-x402.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

const SOLANA_IMAGE_TIMEOUT_MS = 300_000;

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json);
  const { prompt, action, model, image, mask, size, quality, agent_id } = built.value;
  const selectedModel = model || "openai/gpt-image-2";

  const estimate = estimateCost(selectedModel, size);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    let imageUrl: string | undefined;
    let billedUsd = estimate;

    if (getChain() === "solana") {
      const { endpoint, body } = buildSolanaImageRequest(action, { model: selectedModel, prompt, size, quality, image, mask });
      const { data, paidUsd } = await solanaPaidPost(endpoint, body, SOLANA_IMAGE_TIMEOUT_MS, {
        // REQ-220: the Solana gateway's price carries a markup over the Base
        // estimate table, so the real quote can exceed what was reserved at
        // the gate. Re-validate against the cap BEFORE any payment is signed;
        // throwing here aborts before solanaPaidPost ever calls
        // createSolanaPaymentPayload.
        onQuote: (quotedUsd) => {
          const check = gated.paid.reverify(quotedUsd);
          if (!check.allowed) throw new Error(check.reason ?? "Budget cap would be exceeded by the real quoted price.");
        },
      });
      gated.paid.commit(paidUsd);
      billedUsd = paidUsd ?? estimate;
      imageUrl = (data as { data?: Array<{ url?: string }> }).data?.[0]?.url;
    } else {
      const client = getImageClient();
      const response = action === "edit"
        ? await client.edit(prompt, image as never, { model: selectedModel, size, ...(mask ? { mask } : {}) })
        : await client.generate(prompt, { model: selectedModel, size, quality: quality as "standard" | "hd" });
      gated.paid.commit(estimate);
      imageUrl = response.data?.[0]?.url;
    }

    if (!imageUrl) throw new Error("No image URL in response");

    return ok(
      { url: imageUrl, prompt, model: selectedModel, cost_usd: billedUsd },
      opts.json,
      `Image: ${imageUrl}\nPrompt: ${prompt}\nModel: ${selectedModel}\nCost: $${billedUsd.toFixed(4)}`,
    );
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json, { altModels: "google/nano-banana, zai/cogview-4", chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
