// Verbatim port of blockrun-mcp's src/tools/markets.ts:11-24 (verification-architecture.md §1.1).
export function estimateMarketCost(path: string, body: unknown): number {
  if (body !== undefined) return 0.005;
  const p = path.toLowerCase();
  if (
    p.includes("wallet") ||
    p.includes("smart") ||
    p.includes("matching-markets") ||
    p.includes("markets/search") ||
    p.includes("binance/")
  ) {
    return 0.005;
  }
  return 0.001;
}
