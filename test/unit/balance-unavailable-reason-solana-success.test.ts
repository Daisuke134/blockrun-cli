// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-DX-010 (solana half, "reason absent" case). Split into its OWN file for the
// same module-cache-isolation reason as balance-unavailable-reason-solana-error.test.ts
// (a sibling file, not the same one — this test needs a DIFFERENT SolanaLLMClient mock,
// which a second mock.module() call for the same specifier in one file cannot express
// once shell/wallet.js is already cached from the first).
import { test, mock } from "node:test";
import assert from "node:assert/strict";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { default: _unused, ...realNamed } = (await import("@blockrun/llm")) as Record<string, unknown>;
mock.module("@blockrun/llm", {
  namedExports: {
    ...realNamed,
    SolanaLLMClient: class {
      async getBalance(): Promise<number> {
        return 12.5;
      }
    },
  },
});

const { getChainBalance } = await import("../../src/shell/wallet.js");

test("PROP-DX-010 (solana): when the Solana client's getBalance() succeeds, reason is ABSENT", async () => {
  const result = await getChainBalance("solana", "11111111111111111111111111111111") as { balance: number | null; reason?: string };
  assert.equal(result.balance, 12.5);
  assert.equal("reason" in result, false);
});
