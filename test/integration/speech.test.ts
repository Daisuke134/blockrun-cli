// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-123 (REQ-148–151). speak/sound_effect go through payOnce(); voices is free via
// fetchJson() (with a built-in-alias fallback per REQ-149, not exercised here since the
// mock always succeeds).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";

// A quote higher than the speak-path estimate, used by the "over-budget-quote" mode
// to prove REQ-220's reverify wiring.
const OVER_BUDGET_QUOTE_USD = 0.5;
let quoteMode: "normal" | "over-budget-quote" = "normal";
mock.module("../../src/shell/manual-x402.js", {
  namedExports: {
    payOnce: async (req: any) => {
      if (quoteMode === "over-budget-quote") {
        // Mirrors the real payOnce: onQuote is called with the REAL 402-quoted
        // amount BEFORE any signature is produced.
        req.onQuote?.(OVER_BUDGET_QUOTE_USD);
      }
      return { data: { url: "https://blockrun.ai/media/fake.mp3", format: "mp3", characters: 2 }, billedUsd: 0.001 };
    },
  },
});
mock.module("../../src/shell/http.js", {
  namedExports: { fetchJson: async () => ({ status: 200, data: { data: [{ voice_id: "v1", alias: "sarah" }] } }) },
});
mock.module("../../src/shell/wallet.js", { namedExports: { getChain: () => "base", getOrCreateWalletKey: () => "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" } });

const { run } = await import("../../src/commands/speech.js");

function newBudget(limit: number | null = null): BudgetState {
  return { limit, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-151: speak reports the real settled cost (cost floor for a 2-char input)", async () => {
  const budget = newBudget();
  const res = await run({ input: "hi" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.cost_usd, 0.001);
});

test("REQ-149: voices is free and never touches the budget ledger", async () => {
  const budget = newBudget();
  const res = await run({ action: "voices" }, { json: true }, budget);
  assert.equal(res.exitCode, 0);
  assert.equal(budget.spent, 0);
});

test("REQ-150: an oversized sound_effect input is rejected locally before any network call", async () => {
  const budget = newBudget();
  const res = await run({ action: "sound_effect", input: "x".repeat(1001) }, { json: true }, budget);
  assert.notEqual(res.exitCode, 0);
  assert.equal(budget.spent, 0);
});

test("REQ-220: a real quote above the per-invocation budget cap (but above the speak-path estimate) aborts BEFORE signing, no charge recorded", async () => {
  quoteMode = "over-budget-quote";
  try {
    // "hi" costs the $0.001 floor; the cap sits strictly between that estimate and
    // the $0.50 real quote.
    const budget = newBudget(0.1);
    const res = await run({ input: "hi" }, { json: true }, budget);
    assert.notEqual(res.exitCode, 0, "a $0.50 real quote against a $0.10 cap must abort before signing");
    assert.equal(budget.spent, 0, "no charge is recorded when the gate rejects the real quote before signing");
  } finally {
    quoteMode = "normal";
  }
});
