// REQ-006/007/010/011. Pure rendering helpers shared by every commands/<command>.ts.
import { formatError } from "./errors.js";

export function renderJson(result: unknown): string {
  return JSON.stringify(result);
}

export interface RenderedError {
  json: { error: true; message: string };
  human: string;
}

/**
 * Renders a raw error message into BOTH output channels' shapes. The JSON
 * `message` field and the human stderr text are the SAME formatError() output
 * (REQ-010's "collapsed into one field"), so a --json error's message and the
 * non-json stderr text always agree.
 */
export function renderError(rawMessage: string, opts?: { altModels?: string; chain?: "base" | "solana" }): RenderedError {
  const human = formatError(rawMessage, opts);
  return { json: { error: true, message: human }, human };
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

export function fail(rawMessage: string, json: boolean, opts?: { altModels?: string; chain?: "base" | "solana" }): CommandOutcome {
  const { json: jsonBody, human } = renderError(rawMessage, opts);
  return json
    ? { exitCode: 1, stdout: renderJson(jsonBody), stderr: "" }
    : { exitCode: 1, stdout: "", stderr: human };
}
