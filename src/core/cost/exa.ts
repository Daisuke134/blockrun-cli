// Verbatim port of blockrun-mcp's src/tools/exa.ts:21-28 (verification-architecture.md §1.1).
export function estimateExaCost(path: string, body: unknown): number {
  const cleanPath = path.replace(/^\/+/, "").replace(/^v1\/exa\//, "");
  if (cleanPath === "contents") {
    const urls = body && typeof body === "object" ? (body as { urls?: unknown }).urls : undefined;
    return 0.002 * (Array.isArray(urls) && urls.length > 0 ? urls.length : 1);
  }
  return 0.01;
}
