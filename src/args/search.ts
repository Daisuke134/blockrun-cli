// REQ-152–153, REQ-152a, REQ-200, REQ-022. Pure buildRequest for `blockrun search`.
// Canonical surface is --body <json> [--path] [--agent-id]; --query/--sources/
// --max-results/--from-date/--to-date are documented ergonomic aliases (REQ-152a)
// that compile into body.* — never a separate canonical field (decisions.md §10).
import { z } from "zod";
import { coerceBody } from "../core/body.js";
import { hasPathTraversal } from "../core/path-safety.js";
import { toStringArray, type BuildResult } from "./shared.js";

export const schema = z.object({
  path: z.string().optional().default(""),
  body: z.any().optional(),
  agent_id: z.string().optional(),
  query: z.string().optional(),
  sources: z.union([z.array(z.enum(["web", "x", "news"])), z.string()]).optional(),
  max_results: z.number().int().min(1).max(50).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export interface SearchRequest {
  path: string;
  body: Record<string, unknown>;
  agent_id?: string;
}

function mergeAlias(
  body: Record<string, unknown>,
  flagName: string,
  bodyKey: string,
  value: unknown,
): string | undefined {
  if (value === undefined) return undefined;
  if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
    return `--${flagName} conflicts with --body's '${bodyKey}' — supply only one`;
  }
  body[bodyKey] = value;
  return undefined;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<SearchRequest> {
  const path = typeof flags.path === "string" ? flags.path : "";
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\/search\/?/, "");
  if (hasPathTraversal(cleanPath)) {
    return { ok: false, error: `Invalid path '${path}'.` };
  }

  const bodyInput = coerceBody(flags.body);
  const body: Record<string, unknown> =
    bodyInput && typeof bodyInput === "object" && !Array.isArray(bodyInput)
      ? { ...(bodyInput as Record<string, unknown>) }
      : {};

  const scalarAliases: Array<[string, string, unknown]> = [
    ["query", "query", flags.query],
    ["max-results", "max_results", flags.maxResults],
    ["from-date", "from_date", flags.fromDate],
    ["to-date", "to_date", flags.toDate],
  ];
  for (const [flagName, bodyKey, value] of scalarAliases) {
    const err = mergeAlias(body, flagName, bodyKey, value);
    if (err) return { ok: false, error: err };
  }

  if (flags.sources !== undefined) {
    const arr = toStringArray(flags.sources) ?? [];
    for (const s of arr) {
      if (!["web", "x", "news"].includes(s)) {
        return { ok: false, error: `Invalid source '${s}' — must be one of web, x, news` };
      }
    }
    const err = mergeAlias(body, "sources", "sources", arr);
    if (err) return { ok: false, error: err };
  }

  if (typeof body.query !== "string" || body.query.length === 0) {
    return { ok: false, error: "query is required (via --query or --body)" };
  }
  if (body.max_results !== undefined) {
    const mr = body.max_results;
    if (typeof mr !== "number" || mr < 1 || mr > 50) {
      return { ok: false, error: "--max-results must be between 1 and 50" };
    }
  }
  if (body.from_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.from_date))) {
    return { ok: false, error: "--from-date must be YYYY-MM-DD" };
  }
  if (body.to_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.to_date))) {
    return { ok: false, error: "--to-date must be YYYY-MM-DD" };
  }

  const value: SearchRequest = { path: cleanPath, body };
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
