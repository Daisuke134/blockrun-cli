// Verbatim port of blockrun-mcp's src/tools/defi.ts:21-23 (verification-architecture.md §1.1).
export function estimateDefiCost(path: string): number {
  return path.startsWith("prices") ? 0.001 : 0.005;
}
