// REQ-163–165. `blockrun dex` — free, no wallet/x402 involved (mirrors blockrun-mcp's
// src/tools/dex.ts).
import { buildRequest, rankPairs, type DexPair } from "../args/dex.js";
import { fetchJson } from "../shell/http.js";
import { extractErrorMessage } from "../core/errors.js";
import { ok, fail } from "../core/render.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

interface DexScreenerPair extends DexPair {
  dexId: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  priceChange?: { h24: number };
  liquidity?: { usd: number };
  txns?: { h24: { buys: number; sells: number } };
}

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  _budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json, { code: "usage_error" });
  const { query, token, symbol, chain } = built.value;
  const searchTerm = query || symbol || "";

  const url = token
    ? `https://api.dexscreener.com/latest/dex/tokens/${token}`
    : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchTerm)}`;

  try {
    const { status, data } = await fetchJson(url, {}, 8000);
    if (status < 200 || status >= 300) throw new Error(`DexScreener API error: ${status}`);
    const pairs = rankPairs((data.pairs as DexScreenerPair[]) ?? [], chain);

    if (pairs.length === 0) {
      return ok({ pairs: [], count: 0 }, opts.json, `No pairs found for: ${searchTerm || token}`);
    }

    const lines = pairs.map((p) => {
      const price = p.priceUsd ? `$${parseFloat(p.priceUsd).toFixed(6)}` : "N/A";
      const change = p.priceChange?.h24 ? `${p.priceChange.h24 > 0 ? "+" : ""}${p.priceChange.h24.toFixed(2)}%` : "";
      const vol = p.volume?.h24 ? `$${(p.volume.h24 / 1_000_000).toFixed(2)}M` : "";
      const liq = p.liquidity?.usd ? `$${(p.liquidity.usd / 1_000_000).toFixed(2)}M liq` : "";
      const buySell = p.txns?.h24 ? `${p.txns.h24.buys}B/${p.txns.h24.sells}S` : "";
      return `${p.baseToken.symbol}/${p.quoteToken.symbol} (${p.chainId}/${p.dexId})\n  Price: ${price} ${change} | Vol: ${vol} | ${liq} | Txns: ${buySell}\n  Token: ${p.baseToken.address}`;
    });

    return ok({ pairs, count: pairs.length }, opts.json, `[DexScreener - FREE]\n\n${lines.join("\n\n")}`);
  } catch (err) {
    const msg = extractErrorMessage(err);
    return fail(msg, opts.json);
  }
}
