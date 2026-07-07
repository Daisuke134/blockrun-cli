// Shared types/helpers for src/args/<command>.ts pure builders (decisions.md §3, §10).
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
