// REQ-170–171, REQ-200, REQ-022. Pure buildRequest for `blockrun defi`.
import { z } from "zod";
import { hasPathTraversal } from "../core/path-safety.js";
import type { BuildResult } from "./shared.js";

export const schema = z.object({
  path: z.string(),
  agent_id: z.string().optional(),
});

export interface DefiRequest {
  path: string;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<DefiRequest> {
  const path = flags.path;
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, error: "--path is required" };
  }
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\/defillama\//, "").replace(/^api\/v1\/defillama\//, "");
  if (hasPathTraversal(cleanPath)) {
    return { ok: false, error: `Invalid path '${path}'.` };
  }
  const value: DefiRequest = { path: cleanPath };
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
