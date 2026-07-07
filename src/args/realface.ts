// REQ-137–143, REQ-022. Pure buildRequest for `blockrun realface`.
import { z } from "zod";
import { rejectBlockedUrlHost, type BuildResult } from "./shared.js";

const ACTIONS = ["init", "status", "enroll", "portrait", "list"] as const;

export const schema = z.object({
  action: z.enum(ACTIONS),
  name: z.string().min(1).max(64).optional(),
  group_id: z.string().regex(/^legacy_rf_\d+$/).optional(),
  image_url: z.string().url().optional(),
  agent_id: z.string().optional(),
});

export interface RealfaceRequest {
  action: (typeof ACTIONS)[number];
  name?: string;
  groupId?: string;
  imageUrl?: string;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<RealfaceRequest> {
  const action = flags.action;
  if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: `--action must be one of: ${ACTIONS.join(", ")}` };
  }

  const name = typeof flags.name === "string" ? flags.name : undefined;
  if (name !== undefined && (name.length < 1 || name.length > 64)) {
    return { ok: false, error: "--name must be 1-64 characters" };
  }
  const groupId = typeof flags.groupId === "string" ? flags.groupId : undefined;
  if (groupId !== undefined && !/^legacy_rf_\d+$/.test(groupId)) {
    return { ok: false, error: "--group-id must look like 'legacy_rf_NNN'" };
  }
  const imageUrl = typeof flags.imageUrl === "string" ? flags.imageUrl : undefined;
  if (imageUrl !== undefined && !isWellFormedUrl(imageUrl)) {
    return { ok: false, error: "--image-url must be a well-formed URL" };
  }
  // Defense-in-depth (codex-impl-review-1 finding #3): image_url is forwarded
  // verbatim to BlockRun's remote enroll/portrait endpoint as a body field — the
  // REMOTE gateway fetches it server-side, not this CLI process — but reject an
  // obviously internal/private target before ever sending it upstream. Does NOT
  // restrict scheme (REQ-137 still allows any URL-parseable scheme, e.g. http://).
  if (imageUrl !== undefined) {
    const blocked = rejectBlockedUrlHost(imageUrl, "image-url");
    if (blocked) return { ok: false, error: blocked };
  }

  if (action === "init" && name === undefined) {
    return { ok: false, error: "--name is required for --action init" };
  }
  if (action === "status" && groupId === undefined) {
    return { ok: false, error: "--group-id is required for --action status" };
  }
  if (action === "enroll" && (name === undefined || imageUrl === undefined || groupId === undefined)) {
    return { ok: false, error: "--name, --image-url, and --group-id are all required for --action enroll" };
  }
  if (action === "portrait" && (name === undefined || imageUrl === undefined)) {
    return { ok: false, error: "--name and --image-url are required for --action portrait" };
  }

  const value: RealfaceRequest = { action: action as RealfaceRequest["action"] };
  if (name !== undefined) value.name = name;
  if (groupId !== undefined) value.groupId = groupId;
  if (imageUrl !== undefined) value.imageUrl = imageUrl;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}

function isWellFormedUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
