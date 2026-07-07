// REQ-154–155, REQ-154a, REQ-200, REQ-022. Pure buildRequest for `blockrun exa`.
// Canonical surface is --path <...> --body <json> [--agent-id]; the documented
// per-path convenience flags (REQ-154a) compile into body.* (decisions.md §13).
import { z } from "zod";
import { coerceBody } from "../core/body.js";
import { hasPathTraversal } from "../core/path-safety.js";
import { toStringArray, type BuildResult } from "./shared.js";

const EXA_PATHS = ["search", "answer", "contents", "find-similar"] as const;
const EXA_CATEGORIES = ["news", "research paper", "company", "tweet", "github", "pdf"] as const;

export const schema = z.object({
  path: z.enum(EXA_PATHS),
  body: z.any(),
  agent_id: z.string().optional(),
});

export interface ExaRequest {
  path: string;
  body: Record<string, unknown>;
  agent_id?: string;
}

function mergeAlias(body: Record<string, unknown>, flagName: string, bodyKey: string, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
    return `--${flagName} conflicts with --body's '${bodyKey}' — supply only one`;
  }
  body[bodyKey] = value;
  return undefined;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<ExaRequest> {
  const path = flags.path;
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, error: "--path is required" };
  }
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\/exa\//, "");
  if (hasPathTraversal(cleanPath)) {
    return { ok: false, error: `Invalid path '${path}'.` };
  }
  if (!(EXA_PATHS as readonly string[]).includes(cleanPath)) {
    return { ok: false, error: `--path must be one of: ${EXA_PATHS.join(", ")}` };
  }

  const bodyInput = coerceBody(flags.body);
  const body: Record<string, unknown> =
    bodyInput && typeof bodyInput === "object" && !Array.isArray(bodyInput)
      ? { ...(bodyInput as Record<string, unknown>) }
      : {};

  if (cleanPath === "search") {
    for (const [flagName, bodyKey, value] of [
      ["query", "query", flags.query],
      ["num-results", "numResults", flags.numResults],
      ["category", "category", flags.category],
      ["include-domains", "includeDomains", toStringArray(flags.includeDomains)],
      ["exclude-domains", "excludeDomains", toStringArray(flags.excludeDomains)],
    ] as Array<[string, string, unknown]>) {
      const err = mergeAlias(body, flagName, bodyKey, value);
      if (err) return { ok: false, error: err };
    }
    if (body.category !== undefined && !(EXA_CATEGORIES as readonly string[]).includes(body.category as string)) {
      return { ok: false, error: `--category must be one of: ${EXA_CATEGORIES.join(", ")}` };
    }
  } else if (cleanPath === "answer") {
    const err = mergeAlias(body, "query", "query", flags.query);
    if (err) return { ok: false, error: err };
  } else if (cleanPath === "contents") {
    const err = mergeAlias(body, "urls", "urls", toStringArray(flags.urls));
    if (err) return { ok: false, error: err };
  } else if (cleanPath === "find-similar") {
    for (const [flagName, bodyKey, value] of [
      ["url", "url", flags.url],
      ["num-results", "numResults", flags.numResults],
    ] as Array<[string, string, unknown]>) {
      const err = mergeAlias(body, flagName, bodyKey, value);
      if (err) return { ok: false, error: err };
    }
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, error: "--body is required (or its documented per-path alias flags)" };
  }

  const value: ExaRequest = { path: cleanPath, body };
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
