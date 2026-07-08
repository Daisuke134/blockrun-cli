// Port of blockrun-mcp's src/utils/errors.ts (verification-architecture.md §1.1),
// with ONE deliberate deviation: the payment-error branch cannot read a cached
// getChain() (the CLI's pure core has no impure wallet-state import), so the chain
// is passed explicitly via opts.chain (default "base", matching the clone's own
// getChain() default).
import { isTimeoutError } from "../shell/http.js";

const NETWORK_TRANSPORT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"]);

// REQ-DX-015: detects the raw Node fetch()-failure shape BEFORE any string
// processing — a `cause.code` matching one of the 4 live-verified transport codes, or
// (reusing src/shell/http.ts's ALREADY-CORRECT isTimeoutError() verbatim) a client
// -side timeout/abort. Returns the greppable marker suffix to append, or null for
// every non-network-failure case (byte-for-byte unchanged today's output).
function detectNetworkMarker(err: unknown): string | null {
  if (err && typeof err === "object") {
    const cause = (err as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const code = (cause as { code?: unknown }).code;
      if (typeof code === "string" && NETWORK_TRANSPORT_CODES.has(code)) return code;
    }
  }
  if (isTimeoutError(err)) return "timeout";
  return null;
}

export function extractErrorMessage(err: unknown): string {
  const marker = detectNetworkMarker(err);
  const suffix = marker ? ` (network:${marker})` : "";

  if (!err || typeof err !== "object") return `${String(err)}${suffix}`;
  const e = err as { message?: unknown; response?: unknown; statusCode?: unknown };
  const base = typeof e.message === "string" ? e.message : String(err);
  if (e.response === undefined || e.response === null) return `${base}${suffix}`;
  try {
    const body = e.response;
    if (typeof body === "string") return `${body.trim() ? `${base} — ${body}` : base}${suffix}`;
    if (typeof body === "object") {
      const b = body as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof b.message === "string") parts.push(b.message);
      if (typeof b.hint === "string") parts.push(`Hint: ${b.hint}`);
      if (Array.isArray(b.missing_params) && b.missing_params.length) {
        parts.push(`Missing: ${b.missing_params.join(", ")}`);
      }
      if (parts.length === 0) {
        parts.push(JSON.stringify(b));
      }
      return `${base}\n${parts.join("\n")}${suffix}`;
    }
  } catch { /* fall through */ }
  return `${base}${suffix}`;
}

export function isPaymentRejectionError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("insufficient") || m.includes("balance") || m.includes("rejected");
}

export type KnownErrorClass = "model_unavailable" | "server_error" | "payment_error";

// REQ-DX-016: extracted from formatError()'s original three inline consts, preserving
// its EXACT real branch order (isModelUnavailable -> isServerError -> isPaymentError)
// so the human message (formatError) and the machine `code` classifier (REQ-DX-011,
// src/core/error-classification.ts) can never disagree about which branch fired —
// both now call THIS one function. Distinct from the narrower, pre-existing
// isPaymentRejectionError above (no `402` check, no bare-"payment" check) — see
// REQ-DX-016's explicit non-conflation warning; do not substitute one for the other.
export function classifyKnownError(message: string): KnownErrorClass | null {
  const msgLower = message.toLowerCase();
  const hasStatus = (code: string) => new RegExp(`(^|[^0-9.])${code}($|[^0-9.])`).test(msgLower);

  const isModelUnavailable =
    msgLower.includes("not active for requested provider") ||
    msgLower.includes("not found or not active");
  if (isModelUnavailable) return "model_unavailable";

  const isServerError = hasStatus("500") || msgLower.includes("api error after payment");
  if (isServerError) return "server_error";

  const isPaymentError = hasStatus("402") ||
    msgLower.includes("balance") ||
    msgLower.includes("insufficient") ||
    (msgLower.includes("payment") && !hasStatus("500"));
  if (isPaymentError) return "payment_error";

  return null;
}

export function formatError(message: string, opts?: { altModels?: string; chain?: "base" | "solana" }): string {
  const classification = classifyKnownError(message);
  const altHint = opts?.altModels ? ` (e.g. ${opts.altModels})` : "";
  let errorText = `Error: ${message}`;

  if (classification === "model_unavailable") {
    errorText += `\n\nThis model is temporarily unavailable upstream` +
      (opts?.altModels
        ? `. Try a different model${altHint} — it should work right away.`
        : `. Try a different model, or retry shortly.`);
  } else if (classification === "server_error") {
    errorText += `\n\nThis is a temporary API issue. The API may be experiencing problems.` +
      `\nTry again in a few minutes` +
      (opts?.altModels ? `, or use a different model${altHint}.` : `.`);
  } else if (classification === "payment_error") {
    const chain = opts?.chain ?? "base";
    const network = chain === "solana" ? "Solana" : "Base";
    errorText += `\n\nThis error usually means your wallet needs funding.\n` +
      `Run blockrun wallet with action "setup" to get funding instructions.\n\n` +
      `Quick fix: Send USDC to your wallet on ${network} network.`;
    // REQ-FUND-011/013: a static pointer to the card-funding path — Base only
    // (Coinbase Onramp has no Solana support, REQ-FUND-NG-001). No network call
    // here — formatError() stays pure, zero I/O.
    if (chain === "base") {
      errorText += `\n\nPrefer a card? Run: blockrun wallet --action deposit`;
    }
  }

  return errorText;
}
