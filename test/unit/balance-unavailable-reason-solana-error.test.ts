// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-DX-010 (solana half, REQ-DX-022). Split into its OWN file (separate `node
// --test` process) from balance-unavailable-reason.test.ts's base-chain cases: the
// mock.module("@blockrun/llm") call MUST run before this process's first import of
// src/shell/wallet.js (whose SolanaLLMClient binding is fixed at that first
// evaluation) — the same top-of-file pattern test/integration/defi.test.ts uses.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { default: _unused, ...realNamed } = (await import("@blockrun/llm")) as Record<string, unknown>;
mock.module("@blockrun/llm", {
  namedExports: {
    ...realNamed,
    SolanaLLMClient: class {
      async getBalance(): Promise<number> {
        throw new Error("solana rpc unreachable");
      }
    },
  },
});

const { getChainBalance } = await import("../../src/shell/wallet.js");

test("PROP-DX-010 (solana): when the Solana client's getBalance() throws, getChainBalance returns balance:null, reason:'solana_client_error'", async () => {
  const result = await getChainBalance("solana", "11111111111111111111111111111111") as { balance: number | null; reason?: string };
  assert.equal(result.balance, null);
  assert.equal(result.reason, "solana_client_error");
});
