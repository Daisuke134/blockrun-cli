// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-111 (REQ-123–129). Mirrors blockrun-mcp's own image-cost.test.ts mocking idiom:
// mock.module the wallet shell BEFORE importing the command, so the paid ImageClient
// and chain selector are fully faked (no network, no payment).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

let editCalled = false;
const fakeImageClient = {
  generate: async () => ({ data: [{ url: "https://blockrun.ai/media/fake.png" }] }),
  edit: async () => { editCalled = true; return { data: [{ url: "https://blockrun.ai/media/fake-edit.png" }] }; },
};
// Mutable so the Solana tests below (added for REQ-220 coverage) can flip the active
// chain without illegally reassigning a property on a (non-writable) ES module
// namespace object — same pattern as test/integration/video.test.ts's activeChain.
let activeChain: "base" | "solana" = "base";
mock.module("../../src/shell/wallet.js", {
  namedExports: {
    getChain: () => activeChain,
    getImageClient: () => fakeImageClient,
  },
});

let lastOnQuote: ((quotedUsd: number | null) => void) | undefined;
let solanaQuoteAtomicUsdc = "15000000"; // $15 default (deliberately marked-up vs. the Base catalog estimate)
mock.module("../../src/shell/solana-x402.js", {
  namedExports: {
    solanaPaidPost: async (_endpoint: string, _body: unknown, _timeout: number, opts?: { onQuote?: (q: number | null) => void }) => {
      lastOnQuote = opts?.onQuote;
      const quotedUsd = Number(solanaQuoteAtomicUsdc) / 1_000_000;
      opts?.onQuote?.(quotedUsd); // mirrors the real solanaPaidPost: called BEFORE any signing
      return { data: { data: [{ url: "https://blockrun.ai/media/fake-solana.png" }] }, paidUsd: quotedUsd };
    },
  },
});

const { run } = await import("../../src/commands/image.js");

function newBudget(limit: number | null = null): BudgetState {
  return { limit, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-129/REQ-006: generate reports the model's catalog cost in JSON output", async () => {
  activeChain = "base";
  const budget = newBudget();
  const res = await run({ prompt: "a red cube", model: "openai/gpt-image-2", size: "1024x1024" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.cost_usd, 0.06);
  assert.equal(budget.spent, 0.06);
});

test("REQ-126: edit without --image fails locally, no SDK call, nonzero exit", async () => {
  activeChain = "base";
  const budget = newBudget();
  const res = await run({ prompt: "a red cube", action: "edit" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.equal(budget.spent, 0, "no charge on a locally-rejected call");
});

test("REQ-127/REQ-220: edit with a --image URL pointed at a private/loopback host is rejected locally (SSRF guard), no SDK call, no charge", async () => {
  activeChain = "base";
  editCalled = false;
  const budget = newBudget();
  const res = await run({ prompt: "a red cube", action: "edit", model: "openai/gpt-image-2", image: "http://127.0.0.1/evil.png" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0, "an SSRF-blocked --image URL must be rejected before any SDK call");
  assert.equal(editCalled, false, "ImageClient.edit must never be called for a blocked-host image reference");
  assert.equal(budget.spent, 0, "no charge on a locally-rejected call");
});

test("REQ-220 (Solana image): a quote WITHIN the budget cap signs (onQuote does not throw) and reports the real 402-quoted cost", async () => {
  activeChain = "solana";
  solanaQuoteAtomicUsdc = "20000"; // $0.02 — comfortably within an unlimited/large budget
  lastOnQuote = undefined;
  const budget = newBudget();
  const res = await run({ prompt: "a red cube", model: "zai/cogview-4", size: "1024x1024" }, { json: true }, budget);
  assert.equal(res.exitCode, 0, `expected success for a within-cap Solana quote\nstdout:${res.stdout}`);
  assert.ok(lastOnQuote, "solanaPaidPost's onQuote callback must have been wired up");
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.cost_usd, 0.02, "the REAL 402-quoted Solana cost must be reported, not the Base catalog estimate");
  assert.equal(budget.spent, 0.02);
});

test("REQ-220 (Solana image): a quote that EXCEEDS the budget cap aborts BEFORE any charge is recorded (mirrors reReserveIfHigher)", async () => {
  activeChain = "solana";
  // zai/cogview-4's Base catalog estimate is $0.015 (well under the $0.02 cap below),
  // but the REAL Solana 402 quote below ($15, a deliberately marked-up gateway price)
  // must be what gets checked against the cap — proving REQ-220's "re-validate the
  // REAL quoted amount" requirement, not just the pre-call estimate.
  solanaQuoteAtomicUsdc = "15000000"; // $15
  const budget = newBudget(0.02); // a small per-invocation cap
  const res = await run({ prompt: "a red cube", model: "zai/cogview-4", size: "1024x1024" }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0, "a $15 real quote against a $0.02 cap must abort");
  assert.equal(budget.spent, 0, "no charge is recorded when the gate rejects the real quote before signing");
});
