// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-138 (REQ-163–165). Mocks the fetch to DexScreener.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";
import { isTimeoutError as realIsTimeoutError } from "../../src/shell/http.js";

mock.module("../../src/shell/http.js", {
  namedExports: {
    isTimeoutError: realIsTimeoutError,
    fetchJson: async () => ({
      status: 200,
      data: {
        pairs: [
          { chainId: "solana", dexId: "raydium", pairAddress: "p1", baseToken: { address: "a", name: "SOL", symbol: "SOL" }, quoteToken: { symbol: "USDC" }, priceUsd: "150", volume: { h24: 1000 }, priceChange: { h24: 1 }, liquidity: { usd: 500 }, txns: { h24: { buys: 1, sells: 1 } } },
        ],
      },
    }),
  },
});

const { run } = await import("../../src/commands/dex.js");

test("REQ-164/REQ-121: dex is free (no wallet import needed) and returns DexScreener pairs", async () => {
  const budget = { limit: null, spent: 0, calls: 0, agents: new Map() };
  const res = await run({ query: "SOL" }, { json: true }, budget as any);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.pairs[0].baseToken.symbol, "SOL");
});
