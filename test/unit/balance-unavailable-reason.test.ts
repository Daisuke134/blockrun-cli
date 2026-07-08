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
//
// The 2 solana cases live in their OWN sibling files
// (balance-unavailable-reason-solana-error.test.ts /
// -solana-success.test.ts), not here: `shell/wallet.js`'s `SolanaLLMClient` import
// binding is established the FIRST time the module is evaluated in this process — once
// the 3 base-fetch tests below import it (unmocked), no LATER mock.module("@blockrun
// /llm") call in the same file can retroactively change that already-linked binding.
// Each solana test therefore needs its OWN fresh process (a separate `node --test`
// file), with its mock.module() call BEFORE that file's first import of
// shell/wallet.js — the same pattern test/integration/defi.test.ts already uses.
import { test } from "node:test";
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

