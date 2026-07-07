// REQ-163–165, REQ-022 (dex has no agent_id field — REQ-022 explicitly excludes it).
// Pure buildRequest + rankPairs for `blockrun dex`.
import { z } from "zod";
import type { BuildResult } from "./shared.js";

export const schema = z
  .object({
    query: z.string().optional(),
    token: z.string().optional(),
    symbol: z.string().optional(),
    chain: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.query && !data.token && !data.symbol) {
      ctx.addIssue({ code: "custom", message: "at least one of query, token, or symbol is required" });
    }
  });

export interface DexRequest {
  query?: string;
  token?: string;
  symbol?: string;
  chain?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<DexRequest> {
  const query = typeof flags.query === "string" ? flags.query : undefined;
  const token = typeof flags.token === "string" ? flags.token : undefined;
  const symbol = typeof flags.symbol === "string" ? flags.symbol : undefined;
  const chain = typeof flags.chain === "string" ? flags.chain : undefined;
  if (!query && !token && !symbol) {
    return { ok: false, error: "Provide at least one of --query, --token, or --symbol" };
  }
  const value: DexRequest = {};
  if (query !== undefined) value.query = query;
  if (token !== undefined) value.token = token;
  if (symbol !== undefined) value.symbol = symbol;
  if (chain !== undefined) value.chain = chain;
  return { ok: true, value };
}

export interface DexPair {
  chainId: string;
  volume: { h24: number };
  [key: string]: unknown;
}

/** REQ-165: pure chain-filter + top-10-by-24h-volume sort, independent of the fetch itself. */
export function rankPairs<T extends DexPair>(pairs: T[], chainFilter: string | undefined): T[] {
  let filtered = pairs;
  if (chainFilter) {
    const needle = chainFilter.toLowerCase();
    filtered = filtered.filter((p) => p.chainId.toLowerCase().includes(needle));
  }
  return [...filtered]
    .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
    .slice(0, 10);
}
