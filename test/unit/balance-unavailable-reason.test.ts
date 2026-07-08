// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-DX-010 (REQ-DX-020, -021, -022, -023). Tier 1, MOCKED — forces
// getBaseUsdcBalance/getSolanaUsdcBalance's real null-producing code paths (all 3 Base
// RPC fetches rejected; the Solana client's getBalance() throws) via the REAL underlying
// primitives (global fetch, @blockrun/llm's SolanaLLMClient), not by mocking
// getChainBalance itself away — so the assertions below exercise the REAL reason-
// derivation logic REQ-DX-021/022 describe, not a stand-in.
//
// Contract assumed (Phase 2's natural, minimal design per REQ-DX-020's "gain a NEW
// field balanceUnavailableReason, present ONLY when balance is null"): getChainBalance()
// returns { balance: number | null; reason?: "all_rpcs_failed" | "solana_client_error" }
// instead of today's bare number | null.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;

test("PROP-DX-010 (base): when ALL 3 configured Base RPC URLs reject, getChainBalance returns balance:null, reason:'all_rpcs_failed'", async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  const { getChainBalance } = await import("../../src/shell/wallet.js");
  const result = await getChainBalance("base", "0x0000000000000000000000000000000000dEaD");
  assert.equal((result as { balance: number | null }).balance, null);
  assert.equal((result as { reason?: string }).reason, "all_rpcs_failed");
});

test("PROP-DX-010 (base): when a Base RPC returns unparseable data (not a fetch failure), the SAME 'all_rpcs_failed' reason applies once all 3 attempts exhaust", async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (async () => ({
    json: async () => ({ result: "not-a-hex-quantity" }),
  })) as unknown as typeof fetch;
  const { getChainBalance } = await import("../../src/shell/wallet.js");
  const result = await getChainBalance("base", "0x0000000000000000000000000000000000dEaD");
  assert.equal((result as { balance: number | null }).balance, null);
  assert.equal((result as { reason?: string }).reason, "all_rpcs_failed");
});

test("PROP-DX-010 (base): when a Base RPC succeeds with a real (including exactly zero) balance, reason is ABSENT entirely — not null, not an empty string", async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (async () => ({
    json: async () => ({ result: "0x0" }),
  })) as unknown as typeof fetch;
  const { getChainBalance } = await import("../../src/shell/wallet.js");
  const result = await getChainBalance("base", "0x0000000000000000000000000000000000dEaD") as { balance: number | null; reason?: string };
  assert.equal(result.balance, 0);
  assert.equal("reason" in result, false, "a real (even zero) balance must not carry a balanceUnavailableReason key at all");
});

test("PROP-DX-010 (solana): when the Solana client's getBalance() throws, getChainBalance returns balance:null, reason:'solana_client_error'", async () => {
  const real = await import("@blockrun/llm");
  mock.module("@blockrun/llm", {
    namedExports: {
      ...real,
      SolanaLLMClient: class {
        async getBalance(): Promise<number> {
          throw new Error("solana rpc unreachable");
        }
      },
    },
  });
  const { getChainBalance } = await import("../../src/shell/wallet.js");
  const result = await getChainBalance("solana", "11111111111111111111111111111111") as { balance: number | null; reason?: string };
  assert.equal(result.balance, null);
  assert.equal(result.reason, "solana_client_error");
});

test("PROP-DX-010 (solana): when the Solana client's getBalance() succeeds, reason is ABSENT", async () => {
  const real = await import("@blockrun/llm");
  mock.module("@blockrun/llm", {
    namedExports: {
      ...real,
      SolanaLLMClient: class {
        async getBalance(): Promise<number> {
          return 12.5;
        }
      },
    },
  });
  const { getChainBalance } = await import("../../src/shell/wallet.js");
  const result = await getChainBalance("solana", "11111111111111111111111111111111") as { balance: number | null; reason?: string };
  assert.equal(result.balance, 12.5);
  assert.equal("reason" in result, false);
});
