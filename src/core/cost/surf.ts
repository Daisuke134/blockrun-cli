// Verbatim port of blockrun-mcp's src/tools/surf.ts:69-77 (verification-architecture.md §1.1).
import { normalizeClassifyPath } from "../path-safety.js";

const SURF_T3_PATHS = new Set([
  "onchain/sql",
  "onchain/query",
  "onchain/schema",
  "chat/completions",
]);

const SURF_T2_PATHS = new Set([
  "exchange/depth",
  "exchange/klines",
  "exchange/funding-history",
  "exchange/long-short-ratio",
  "market/liquidation/exchange-list",
  "market/liquidation/order",
  "market/liquidation/chart",
  "market/onchain-indicator",
  "market/price-indicator",
  "prediction-market/polymarket/positions",
  "prediction-market/polymarket/activity",
  "social/detail",
  "social/ranking",
  "social/smart-followers/history",
  "social/mindshare",
  "token/dex-trades",
  "token/holders",
  "token/transfers",
  "web/fetch",
]);

const SURF_T2_PREFIXES = ["search/", "wallet/"];

export function estimateSurfCost(path: string): number {
  const p = normalizeClassifyPath(path);
  if (SURF_T3_PATHS.has(p)) return 0.02;
  if (SURF_T2_PATHS.has(p)) return 0.005;
  for (const prefix of SURF_T2_PREFIXES) {
    if (p.startsWith(prefix)) return 0.005;
  }
  return 0.001;
}
