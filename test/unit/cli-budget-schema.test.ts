// Run with: npm test (tsx --test)
// PROP-011 (REQ-019, REQ-019a, REQ-019b). Pure encode/decode/state-bridge functions for
// the persisted ~/.blockrun/cli-budget.json ledger. Zero fs access in this file — the
// actual file I/O is shell/budget-store.ts, covered by test/integration/budget-store.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyLedger,
  encodeBudgetLedger,
  decodeBudgetLedger,
  toBudgetState,
  fromBudgetState,
  checkPersistedBudget,
  applyPersistedSpend,
} from "../../src/core/cli-budget-schema.js";

const FIXED_NOW = () => "2026-07-08T00:00:00.000Z";

test("REQ-019a: emptyLedger seeds global.limit from a positive seed, else null; spent/calls start at 0", () => {
  const seeded = emptyLedger(5, FIXED_NOW);
  assert.equal(seeded.version, 1);
  assert.deepEqual(seeded.global, { limit: 5, spent: 0, calls: 0 });
  assert.deepEqual(seeded.agents, {});
  assert.equal(seeded.updatedAt, "2026-07-08T00:00:00.000Z");

  const unseeded = emptyLedger(null, FIXED_NOW);
  assert.equal(unseeded.global.limit, null);
});

test("REQ-019a: encode/decode round-trips the ledger shape exactly", () => {
  const ledger = emptyLedger(2, FIXED_NOW);
  ledger.agents["research"] = { limit: 1, spent: 0.5, calls: 3 };
  const raw = encodeBudgetLedger(ledger);
  const decoded = decodeBudgetLedger(raw);
  assert.deepEqual(decoded, ledger);
});

test("REQ-019a: decodeBudgetLedger rejects a malformed/wrong-shape payload rather than silently coercing it", () => {
  assert.throws(() => decodeBudgetLedger("not json"));
  assert.throws(() => decodeBudgetLedger(JSON.stringify({ version: 2, global: {}, agents: {} })), /version/);
});

test("REQ-019/PROP-011: toBudgetState/fromBudgetState round-trip the agents Map<->plain-object", () => {
  const ledger = emptyLedger(3, FIXED_NOW);
  ledger.agents["a1"] = { limit: 1, spent: 0.2, calls: 2 };
  ledger.global.spent = 0.5;
  ledger.global.calls = 1;

  const state = toBudgetState(ledger);
  assert.equal(state.limit, 3);
  assert.equal(state.spent, 0.5);
  assert.ok(state.agents instanceof Map);
  assert.deepEqual(state.agents.get("a1"), { limit: 1, spent: 0.2, calls: 2 });

  const back = fromBudgetState(state, FIXED_NOW());
  assert.deepEqual(back, ledger);
});

test("REQ-019c: checkPersistedBudget rejects locally when the persisted global limit would be exceeded", () => {
  const ledger = emptyLedger(1, FIXED_NOW);
  ledger.global.spent = 0.95;
  const result = checkPersistedBudget(ledger, undefined, 0.1);
  assert.equal(result.allowed, false);
});

test("REQ-019c: checkPersistedBudget rejects locally when a per-agent limit would be exceeded", () => {
  const ledger = emptyLedger(null, FIXED_NOW);
  ledger.agents["research"] = { limit: 1, spent: 0.9, calls: 5 };
  const result = checkPersistedBudget(ledger, "research", 0.2);
  assert.equal(result.allowed, false);
});

test("REQ-019c/REQ-021: applyPersistedSpend books the REAL settled cost (not the estimate) and refreshes updatedAt", () => {
  const ledger = emptyLedger(10, FIXED_NOW);
  const later = () => "2026-07-08T00:05:00.000Z";
  const updated = applyPersistedSpend(ledger, undefined, 0.5, 0.02, later);
  assert.equal(updated.global.spent, 0.5);
  assert.equal(updated.global.calls, 1);
  assert.equal(updated.updatedAt, "2026-07-08T00:05:00.000Z");
  assert.equal(ledger.global.spent, 0, "applyPersistedSpend must not mutate the input ledger (immutable)");
});
