// REQ-DX-011, REQ-DX-012. Classifies a raw error MESSAGE STRING (the SAME string every
// commands/<name>.ts catch block already produces via extractErrorMessage()) into one
// of the 6 REAL, currently-distinguishable failure classes, or no code at all (the
// fallback — exactly today's universal exit code 1).
//
// This function handles the "generic post-network catch-and-classify point" (items
// 4-6: insufficient_funds/upstream_error/network_error) PLUS the two other message
// -pattern-distinguishable structural codes (budget_exceeded/quote_exceeded, items
// 2-3 — their REAL message text, per src/core/budget.ts's checkBudget and
// src/commands/{video,shared}.ts's ground-truth strings, IS reliably pattern
// -matchable). The ONE code this function cannot derive from message text alone is
// usage_error (item 1): src/args/*.ts buildRequest() validation messages are too
// heterogeneous across the 18 command schemas to share a common pattern — that code is
// set via src/core/render.ts's fail() explicit `code` override at each command's
// `if (!built.ok) return fail(built.error, opts.json, { code: "usage_error" })` line,
// which bypasses this function entirely.
import { classifyKnownError } from "./errors.js";

export type ErrorCode =
  | "usage_error"
  | "budget_exceeded"
  | "quote_exceeded"
  | "insufficient_funds"
  | "upstream_error"
  | "network_error";

export const EXIT_CODE_FOR_CODE: Record<ErrorCode, number> = {
  usage_error: 2,
  budget_exceeded: 2,
  quote_exceeded: 3,
  insufficient_funds: 3,
  upstream_error: 4,
  network_error: 4,
};

export interface ClassifiedError {
  code?: ErrorCode;
  exitCode: number;
}

const QUOTE_EXCEEDED_PATTERNS = [
  /exceeds --max-quote-usd/,
  /would be exceeded by the real quoted price/,
];
const BUDGET_EXCEEDED_PATTERN = /would be exceeded \(/;
const NETWORK_MARKER_PATTERN = /\(network:/;

export function classifyErrorCode(message: string): ClassifiedError {
  // (a) network_error — checked FIRST (REQ-DX-011): a transport-level failure that
  // never received an HTTP response cannot also carry a payment/model-unavailable
  // token, so there is no real priority ambiguity in checking it first. REQ-DX-015's
  // extractErrorMessage() appends this exact "(network:...)" marker before the
  // message ever reaches here.
  if (NETWORK_MARKER_PATTERN.test(message)) {
    return { code: "network_error", exitCode: EXIT_CODE_FOR_CODE.network_error };
  }
  // quote_exceeded (item 3) — checked before budget_exceeded's broader "would be
  // exceeded (" pattern, since the shared reverify() rejection reason can reuse that
  // same checkBudget-derived text (see video.ts's onQuote handler).
  if (QUOTE_EXCEEDED_PATTERNS.some((p) => p.test(message))) {
    return { code: "quote_exceeded", exitCode: EXIT_CODE_FOR_CODE.quote_exceeded };
  }
  // budget_exceeded (item 2) — src/core/budget.ts's checkBudget's exact
  // "...would be exceeded (...)" shape, reused verbatim by the persisted-ledger check.
  if (BUDGET_EXCEEDED_PATTERN.test(message)) {
    return { code: "budget_exceeded", exitCode: EXIT_CODE_FOR_CODE.budget_exceeded };
  }
  // (b) REQ-DX-016's order-preserving extraction of formatError()'s existing branches.
  const known = classifyKnownError(message);
  if (known === "model_unavailable" || known === "server_error") {
    return { code: "upstream_error", exitCode: EXIT_CODE_FOR_CODE.upstream_error };
  }
  if (known === "payment_error") {
    return { code: "insufficient_funds", exitCode: EXIT_CODE_FOR_CODE.insufficient_funds };
  }
  // (c) no match — the fallback, exactly today's universal exit code.
  return { exitCode: 1 };
}
