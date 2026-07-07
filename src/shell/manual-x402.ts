// Impure shell: the shared submit→402→sign→(poll) flow for video/music/speech/realface
// (decisions.md §6). This is the impure chokepoint per verification-architecture.md §1.2 —
// network + the SDK's own createPaymentPayload/parsePaymentRequired/extractPaymentDetails,
// NEVER a hand-constructed x402 payload (REQ-221). Base URL is overridable via
// BLOCKRUN_API_BASE_URL for the Tier 2b local-stub-server test only (decisions.md §11) —
// not a documented user-facing feature.
import { privateKeyToAccount } from "viem/accounts";
import { createPaymentPayload, parsePaymentRequired, extractPaymentDetails } from "@blockrun/llm";
import { amountToUsd } from "../core/budget.js";
import { fetchWithTimeout } from "./http.js";
import { getOrCreateWalletKey } from "./wallet.js";

function apiBase(): string {
  return process.env.BLOCKRUN_API_BASE_URL || "https://blockrun.ai/api";
}

function apiOrigin(): string {
  return apiBase().replace(/\/api$/, "");
}

export interface X402Request {
  endpoint: string;
  body: Record<string, unknown>;
  resourceDescription: string;
  maxTimeoutSeconds?: number;
  /** Called with the real 402-quoted USD amount BEFORE createPaymentPayload is ever
   *  invoked. Throwing here aborts the whole call — no signature is ever produced. */
  onQuote?: (quotedUsd: number | null) => void;
}

export interface X402Result {
  data: Record<string, unknown>;
  billedUsd: number | null;
  txHash?: string;
}

interface ProbeResult {
  url: string;
  paymentPayload: string;
  quotedUsd: number | null;
}

async function probeAndSign(req: X402Request): Promise<ProbeResult> {
  const url = `${apiBase()}${req.endpoint}`;
  const privateKey = getOrCreateWalletKey();
  const account = privateKeyToAccount(privateKey);

  const resp402 = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  }, 15_000);

  if (resp402.status !== 402) {
    const data = await resp402.json().catch(() => ({}));
    throw new Error(`Unexpected status ${resp402.status} (the endpoint did not return a quote): ${JSON.stringify(data)}`);
  }

  const prHeader = resp402.headers.get("payment-required") || resp402.headers.get("PAYMENT-REQUIRED");
  if (!prHeader) throw new Error("No PAYMENT-REQUIRED header in 402 response");

  const paymentRequired = parsePaymentRequired(prHeader);
  const details = extractPaymentDetails(paymentRequired);
  const quotedUsd = amountToUsd(details.amount);

  // The mechanical proof for REQ-135a: this callback runs and may throw BEFORE
  // createPaymentPayload() below is ever called.
  if (req.onQuote) req.onQuote(quotedUsd);

  const paymentPayload = await createPaymentPayload(
    privateKey,
    account.address,
    details.recipient,
    details.amount,
    details.network || "eip155:8453",
    {
      resourceUrl: details.resource?.url || url,
      resourceDescription: details.resource?.description || req.resourceDescription,
      maxTimeoutSeconds: Math.max(details.maxTimeoutSeconds || 0, req.maxTimeoutSeconds ?? 600),
      extra: details.extra,
    },
  );

  return { url, paymentPayload, quotedUsd };
}

/** Single probe → 402 → sign → resubmit round trip (speech speak/sound_effect, realface enroll/portrait). */
export async function payOnce(req: X402Request): Promise<X402Result> {
  const { url, paymentPayload, quotedUsd } = await probeAndSign(req);

  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": paymentPayload },
    body: JSON.stringify(req.body),
  }, 90_000);

  if (resp.status === 402) throw new Error("Payment rejected. Check your wallet balance.");
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(`API error ${resp.status}: ${JSON.stringify(errBody)}`);
  }

  const txHash = resp.headers.get("X-Payment-Receipt") || resp.headers.get("x-payment-receipt") || undefined;
  const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
  return { data, billedUsd: quotedUsd, txHash };
}

/** Same round trip, then polls the same URL with the same payment header until
 *  status:"completed"/"failed" or the budget elapses (video, music). */
export async function payAndPoll(
  req: X402Request & { pollIntervalMs: number; totalBudgetMs: number },
): Promise<X402Result> {
  const { url, paymentPayload, quotedUsd } = await probeAndSign(req);

  const submitResp = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": paymentPayload },
    body: JSON.stringify(req.body),
  }, 95_000);

  if (submitResp.status === 402) throw new Error("Payment rejected. Check your wallet balance.");
  if (!submitResp.ok && submitResp.status !== 202) {
    const errBody = await submitResp.json().catch(() => ({ error: "Submit failed" }));
    throw new Error(`API error ${submitResp.status}: ${JSON.stringify(errBody)}`);
  }

  if (submitResp.status !== 202) {
    // Inline completion — the stub/gateway settled and returned the result directly.
    const txHash = submitResp.headers.get("X-Payment-Receipt") || submitResp.headers.get("x-payment-receipt") || undefined;
    const body = await submitResp.json().catch(() => ({})) as { data?: unknown };
    const item = Array.isArray(body.data) ? body.data[0] : body.data;
    if (!item || typeof item !== "object") {
      // REQ-146: an X-Payment-Receipt present but the body malformed/missing means
      // the spend already settled on-chain — surface that rather than silently
      // dropping the charge, while still failing the call (no result to show).
      if (txHash) return { data: {}, billedUsd: quotedUsd, txHash };
      throw new Error(`No result in response: ${JSON.stringify(body)}`);
    }
    return { data: item as Record<string, unknown>, billedUsd: quotedUsd, txHash };
  }

  // Async submit (202) — poll with the SAME payment header until completed/failed.
  const submitData = await submitResp.json().catch(() => ({})) as { poll_url?: string; status?: string };
  if (!submitData.poll_url) throw new Error(`Async submit missing poll_url: ${JSON.stringify(submitData)}`);
  const pollAbsoluteUrl = submitData.poll_url.startsWith("http") ? submitData.poll_url : `${apiOrigin()}${submitData.poll_url}`;

  const startedAt = Date.now();
  let lastStatus = submitData.status || "queued";
  while (Date.now() - startedAt < req.totalBudgetMs) {
    await new Promise((r) => setTimeout(r, req.pollIntervalMs));

    const pollResp = await fetchWithTimeout(pollAbsoluteUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": paymentPayload },
    }, 90_000);

    const pollData = await pollResp.json().catch(() => ({})) as { status?: string; data?: unknown; error?: string };
    lastStatus = pollData.status || lastStatus;

    if (pollResp.status === 202 && (lastStatus === "queued" || lastStatus === "in_progress")) continue;
    if (lastStatus === "failed") throw new Error(`Upstream generation failed: ${pollData.error || "unknown"}. No payment taken.`);
    if (pollResp.ok && lastStatus === "completed") {
      const item = Array.isArray(pollData.data) ? pollData.data[0] : pollData.data;
      if (!item || typeof item !== "object") throw new Error("Completed poll missing data");
      const txHash = pollResp.headers.get("X-Payment-Receipt") || pollResp.headers.get("x-payment-receipt") || undefined;
      return { data: item as Record<string, unknown>, billedUsd: quotedUsd, txHash };
    }
    if (!pollResp.ok && pollResp.status !== 202 && pollResp.status !== 504) {
      throw new Error(`Poll error ${pollResp.status}: ${JSON.stringify(pollData)}`);
    }
    // 504 on poll = transient upstream poll timeout — retry.
  }

  throw new Error(`Generation did not complete within ${Math.round(req.totalBudgetMs / 1000)}s (last status: ${lastStatus}). No payment was taken.`);
}
