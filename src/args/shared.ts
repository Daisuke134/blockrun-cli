// Shared types/helpers for src/args/<command>.ts pure builders (decisions.md §3, §10).
import { isBlockedFetchHost } from "../core/ssrf.js";

export type BuildResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * REQ-023 positional-vs-canonical alias resolution: a bare positional argument
 * (commander's `$positional: string[]`) stands in for a required canonical scalar
 * flag. Supplying BOTH is a conflict error; supplying only one resolves to it.
 */
export function resolvePositionalAlias(
  flags: Record<string, unknown>,
  canonical: unknown,
  flagName: string,
): BuildResult<string | undefined> {
  const positional = Array.isArray(flags.$positional) ? (flags.$positional as unknown[]) : undefined;
  const posValue = positional && positional.length > 0 && typeof positional[0] === "string" ? positional[0] : undefined;
  if (posValue !== undefined && canonical !== undefined) {
    return { ok: false, error: `positional argument conflicts with --${flagName} — supply only one` };
  }
  if (canonical !== undefined && typeof canonical !== "string") {
    return { ok: false, error: `--${flagName} must be a string` };
  }
  return { ok: true, value: posValue !== undefined ? posValue : (canonical as string | undefined) };
}

/** Normalizes a --foo/--foo-csv style flag: accepts an array, or a comma-separated string. */
export function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return undefined;
}

/**
 * Defense-in-depth host check for a URL field this CLI does NOT fetch itself but
 * forwards verbatim to BlockRun's remote API as a body field (e.g. video's
 * --image-url/--last-frame-url, realface's --image-url — the remote gateway fetches
 * these server-side, not this process). Unlike src/shell/image-fetch.ts's
 * toImageDataUri (which performs a REAL local fetch and is the load-bearing SSRF
 * guard for image --image/--mask, per REQ-127), this is a cheap pre-flight rejection
 * so the CLI never even sends an obviously-internal target upstream. Returns an error
 * string when the host is blocked, else undefined.
 */
export function rejectBlockedUrlHost(url: string, flagName: string): string | undefined {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return undefined; // malformed URL — the schema-level url() check already rejects this
  }
  if (isBlockedFetchHost(hostname)) {
    return `--${flagName} refuses a private/loopback/link-local address: ${hostname}`;
  }
  return undefined;
}
