// Verbatim port of blockrun-mcp's src/utils/body.ts (verification-architecture.md §1.1).
export function coerceBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  const trimmed = body.trim();
  if (trimmed === "") return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
}

export function asStructuredContent(result: unknown): Record<string, unknown> {
  return (typeof result === "object" && result !== null && !Array.isArray(result)
    ? result
    : { result }) as Record<string, unknown>;
}
