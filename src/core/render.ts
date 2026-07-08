// REQ-006/007/010/011, REQ-DX-010–014. Pure rendering helpers shared by every
// commands/<command>.ts — the ONE shared classification chokepoint (REQ-DX-014): every
// one of the 18 commands' catch blocks already ends in `fail(...)`, so wiring the new
// `code`/exit-code system in here, once, gives all 18 the same behavior for free.
import { formatError } from "./errors.js";
import { classifyErrorCode, EXIT_CODE_FOR_CODE, type ErrorCode } from "./error-classification.js";

export function renderJson(result: unknown): string {
  return JSON.stringify(result);
}

export interface RenderedError {
  json: { error: true; code?: ErrorCode; message: string };
  human: string;
  exitCode: number;
}

/**
 * Renders a raw error message into BOTH output channels' shapes. The JSON
 * `message` field and the human stderr text are the SAME formatError() output
 * (REQ-010's "collapsed into one field"), so a --json error's message and the
 * non-json stderr text always agree.
 *
 * `opts.code`, when passed, is an EXPLICIT structural override (REQ-DX-011 items 1-3
 * — usage_error/budget_exceeded/quote_exceeded — detected by the CALLER at a
 * structurally distinct point, not derivable from message text alone for
 * usage_error). When omitted, `code` (and its exit code) is derived automatically
 * from the message via classifyErrorCode() — REQ-DX-011's generic
 * catch-and-classify path (network_error / upstream_error / insufficient_funds /
 * no-code fallback), which also happens to correctly pattern-match
 * budget_exceeded/quote_exceeded's real, distinguishable message shapes.
 */
export function renderError(
  rawMessage: string,
  opts?: { altModels?: string; chain?: "base" | "solana"; code?: ErrorCode },
): RenderedError {
  const human = formatError(rawMessage, opts);
  const classified = opts?.code
    ? { code: opts.code, exitCode: EXIT_CODE_FOR_CODE[opts.code] }
    : classifyErrorCode(rawMessage);
  const json: RenderedError["json"] = classified.code
    ? { error: true, code: classified.code, message: human }
    : { error: true, message: human };
  return { json, human, exitCode: classified.exitCode };
}

export interface CommandOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function ok(result: unknown, json: boolean, humanText: string): CommandOutcome {
  return json
    ? { exitCode: 0, stdout: renderJson(result), stderr: "" }
    : { exitCode: 0, stdout: humanText, stderr: "" };
}

export function fail(
  rawMessage: string,
  json: boolean,
  opts?: { altModels?: string; chain?: "base" | "solana"; code?: ErrorCode },
): CommandOutcome {
  const { json: jsonBody, human, exitCode } = renderError(rawMessage, opts);
  return json
    ? { exitCode, stdout: renderJson(jsonBody), stderr: "" }
    : { exitCode, stdout: "", stderr: human };
}
