// REQ-156–158, REQ-200, REQ-022. Pure buildRequest for `blockrun markets`.
import { z } from "zod";
import { coerceBody } from "../core/body.js";
import { hasPathTraversal } from "../core/path-safety.js";
import type { BuildResult } from "./shared.js";

export const schema = z.object({
  path: z.string(),
  params: z.record(z.string(), z.string()).optional(),
  body: z.any().optional(),
  agent_id: z.string().optional(),
});

export interface MarketsRequest {
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<MarketsRequest> {
  const path = flags.path;
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, error: "--path is required" };
  }
  if (hasPathTraversal(path)) {
    return { ok: false, error: `Invalid path '${path}'.` };
  }
  const body = coerceBody(flags.body);
  const params = flags.params as Record<string, string> | undefined;

  const value: MarketsRequest = { path };
  if (params !== undefined) value.params = params;
  if (body !== undefined) value.body = body;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
