// Verbatim port of blockrun-mcp's src/tools/search.ts:22-33 (verification-architecture.md §1.1).
const SEARCH_PRICE_PER_SOURCE = 0.025;
const SEARCH_DEFAULT_MAX_RESULTS = 10;

export function estimateSearchCost(body: unknown): number {
  if (!body || typeof body !== "object") return SEARCH_PRICE_PER_SOURCE * SEARCH_DEFAULT_MAX_RESULTS;
  const raw = (body as { max_results?: unknown }).max_results;
  const max = typeof raw === "number" && raw > 0 ? Math.min(50, Math.floor(raw)) : SEARCH_DEFAULT_MAX_RESULTS;
  // Round away IEEE-754 multiplication drift (e.g. 0.025 * 3 === 0.07500000000000001)
  // so the estimate matches the exact decimal price a caller would compute by hand.
  return Math.round(SEARCH_PRICE_PER_SOURCE * max * 1e6) / 1e6;
}
