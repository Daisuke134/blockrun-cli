// REQ-175–177, REQ-200, REQ-022. Pure buildRequest for `blockrun phone`.
import { z } from "zod";
import { coerceBody } from "../core/body.js";
import { hasPathTraversal, normalizeClassifyPath } from "../core/path-safety.js";
import type { BuildResult } from "./shared.js";

export const schema = z.object({
  path: z.string(),
  body: z.any().optional(),
  agent_id: z.string().optional(),
});

export interface PhoneRequest {
  path: string;
  body?: unknown;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<PhoneRequest> {
  const path = flags.path;
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, error: "--path is required" };
  }
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\//, "");
  if (hasPathTraversal(cleanPath)) {
    return { ok: false, error: `Invalid path '${path}'.` };
  }
  const body = coerceBody(flags.body);

  if (normalizeClassifyPath(cleanPath) === "voice/call") {
    const from = body && typeof body === "object" ? (body as { from?: unknown }).from : undefined;
    if (typeof from !== "string" || from.length === 0) {
      return { ok: false, error: "voice/call requires a 'from' field in --body referencing a wallet-owned number (provision one with phone/numbers/buy first)." };
    }
  }

  const value: PhoneRequest = { path: cleanPath };
  if (body !== undefined) value.body = body;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
