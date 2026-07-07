// REQ-172–174, REQ-200, REQ-022. Pure buildRequest for `blockrun modal`. Unlike the
// generic passthrough tools (surf/defi/markets/phone/rpc), REQ-172's syntax
// `--path <sandbox/create|sandbox/exec|sandbox/status|sandbox/terminate> --body <json>`
// restricts path to the 4 documented lifecycle actions and requires --body (not
// bracketed in the spec, unlike the other passthrough tools' optional --body).
import { z } from "zod";
import { coerceBody } from "../core/body.js";
import { hasPathTraversal, normalizeClassifyPath } from "../core/path-safety.js";
import type { BuildResult } from "./shared.js";

const MODAL_PATHS = ["sandbox/create", "sandbox/exec", "sandbox/status", "sandbox/terminate"] as const;

export const schema = z.object({
  path: z.enum(MODAL_PATHS),
  body: z.any(),
  agent_id: z.string().optional(),
});

export interface ModalRequest {
  path: string;
  body: unknown;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<ModalRequest> {
  const path = flags.path;
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, error: "--path is required" };
  }
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\/modal\//, "");
  if (hasPathTraversal(cleanPath)) {
    return { ok: false, error: `Invalid path '${path}'.` };
  }
  if (!(MODAL_PATHS as readonly string[]).includes(normalizeClassifyPath(cleanPath))) {
    return { ok: false, error: `--path must be one of: ${MODAL_PATHS.join(", ")}` };
  }
  const body = coerceBody(flags.body);
  if (body === undefined) {
    return { ok: false, error: "--body is required" };
  }
  const value: ModalRequest = { path: cleanPath, body };
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
