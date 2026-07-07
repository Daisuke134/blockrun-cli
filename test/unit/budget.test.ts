// Run with: npm test (tsx --test)
// PROP-010, PROP-011, PROP-012, PROP-203 (REQ-018, REQ-019, REQ-020, REQ-021, REQ-220).
// Verbatim port of blockrun-mcp's budget.test.ts — src/core/budget.ts is a byte-for-byte
// port of the clone's src/utils/budget.ts (verification-architecture.md §1.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amountToUsd,
  checkBudget,
  parseBudgetLimitEnv,
  recordActualSpend,
  recordSpending,
  reReserveIfHigher,
  reserveBudget,
} from "../../src/core/budget.js";
import type { BudgetState } from "../../src/types.js";

function newBudget(limit: number | null = null): BudgetState {
  return { limit, spent: 0, calls: 0, agents: new Map() };
}

test("REQ-021/PROP-012: amountToUsd converts atomic USDC (6 decimals) to USD", () => {
  assert.equal(amountToUsd("1000000"), 1);
  assert.equal(amountToUsd("500000"), 0.5);
  assert.equal(amountToUsd(250000), 0.25);
  assert.equal(amountToUsd("1575"), 0.001575);
});

test("amountToUsd returns null for missing/garbled/non-positive amounts", () => {
  assert.equal(amountToUsd(undefined), null);
  assert.equal(amountToUsd(null), null);
  assert.equal(amountToUsd(""), null);
  assert.equal(amountToUsd("abc"), null);
  assert.equal(amountToUsd("0"), null);
  assert.equal(amountToUsd("-1000"), null);
});

test("REQ-021: recordActualSpend books the real settled cost when known", () => {
  const b = newBudget();
  recordActualSpend(b, 0.5, 0.001, undefined);
  assert.equal(b.spent, 0.5, "records actual, not the $0.001 estimate");
  assert.equal(b.calls, 1);
});

test("recordActualSpend falls back to the estimate when actual is unavailable/zero/negative", () => {
  const b = newBudget();
  recordActualSpend(b, null, 0.02, undefined);
  recordActualSpend(b, 0, 0.02, undefined);
  recordActualSpend(b, -5, 0.02, undefined);
  recordActualSpend(b, NaN, 0.02, undefined);
  assert.equal(Math.round(b.spent * 1000) / 1000, 0.08);
  assert.equal(b.calls, 4);
});

test("REQ-019/PROP-011: budget cap holds once ACTUAL frontier cost is booked", () => {
  const b = newBudget(1);
  assert.equal(checkBudget(b, undefined, 0.02).allowed, true);
  recordActualSpend(b, 0.5, 0.02, undefined);
  assert.equal(b.spent, 0.5);
  assert.equal(checkBudget(b, undefined, 0.02).allowed, true);
  recordActualSpend(b, 0.5, 0.02, undefined);
  assert.equal(b.spent, 1);
  const third = checkBudget(b, undefined, 0.02);
  assert.equal(third.allowed, false);
});

// CORRECTED per behavioral-spec.md v3 (REQ-019/REQ-019a/REQ-019b/REQ-019c, superseding
// an earlier draft this suite was first written against): the CLI PERSISTS a cumulative
// budget ledger to ~/.blockrun/cli-budget.json — a fresh in-memory BudgetState (this
// pure `core/budget.ts` object) legitimately starts at spent:0 on every process launch,
// but that is NOT the same claim as "no cross-process persistence" — the impure
// shell/budget-ledger.ts layer (not exercised by this Tier-1 file) is responsible for
// seeding a freshly-constructed BudgetState from the persisted ledger before the command
// layer uses it, and for writing it back after. This test only proves the pure
// constructor itself carries no hidden state — it does NOT stand in for the
// shell/budget-ledger.ts read/write round trip, which needs its own Tier 2/3 coverage
// (tracked as a gap — see decisions.md §7).
test("a freshly-constructed (pure) BudgetState object itself starts at spent:0 (seeding it from the persisted ledger is the impure shell's job, not core/budget.ts's)", () => {
  const b = newBudget(5);
  recordSpending(b, 3, undefined);
  assert.equal(b.spent, 3);
  const fresh = newBudget(5);
  assert.equal(fresh.spent, 0, "newBudget()/the bare BudgetState constructor carries no hidden state of its own");
});

test("PROP-011 regression guard: booking a flat estimate instead of actual would blow a $1 cap over 50 $0.50 calls", () => {
  const b = newBudget(1);
  for (let i = 0; i < 50; i++) {
    assert.equal(checkBudget(b, undefined, 0.001).allowed, true);
    recordSpending(b, 0.001, undefined);
  }
  assert.equal(Math.round(b.spent * 1000) / 1000, 0.05);
});

test("reserveBudget gates concurrent in-flight calls against the cap (TOCTOU)", () => {
  const b = newBudget(1);
  assert.equal(reserveBudget(b, undefined, 0.5).allowed, true);
  assert.equal(reserveBudget(b, undefined, 0.5).allowed, true);
  assert.equal(reserveBudget(b, undefined, 0.5).allowed, false);
});

test("reserveBudget.release frees the reservation and is idempotent", () => {
  const b = newBudget(1);
  const a = reserveBudget(b, undefined, 0.8);
  assert.equal(a.allowed, true);
  assert.equal(reserveBudget(b, undefined, 0.8).allowed, false);
  a.release();
  a.release();
  assert.equal(b.spent, 0);
  assert.equal(reserveBudget(b, undefined, 0.8).allowed, true);
});

test("reserve + recordActualSpend + release nets the actual settled cost", () => {
  const b = newBudget(10);
  const g = reserveBudget(b, undefined, 0.02);
  assert.equal(g.allowed, true);
  recordActualSpend(b, 0.5, 0.02, undefined);
  g.release();
  assert.equal(b.spent, 0.5);
  assert.equal(b.calls, 1);
});

test("a blocked reserveBudget makes no reservation (release is a safe no-op)", () => {
  const b = newBudget(0.01);
  const g = reserveBudget(b, undefined, 0.5);
  assert.equal(g.allowed, false);
  assert.equal(b.spent, 0);
  g.release();
  assert.equal(b.spent, 0);
});

test("reserveBudget enforces per-agent caps across concurrent calls", () => {
  const b = newBudget(null);
  b.agents.set("a1", { limit: 1, spent: 0, calls: 0 });
  assert.equal(reserveBudget(b, "a1", 0.6).allowed, true);
  assert.equal(reserveBudget(b, "a1", 0.6).allowed, false);
});

test("REQ-220/PROP-203: reReserveIfHigher swaps to the higher actual and holds only that amount", () => {
  const b = newBudget(10);
  const g0 = reserveBudget(b, undefined, 0.05);
  const g1 = reReserveIfHigher(b, g0, undefined, 0.05, 0.09);
  assert.equal(g1.allowed, true);
  assert.equal(Math.round(b.spent * 100) / 100, 0.09);
});

test("reReserveIfHigher keeps the original reservation when actual is <= estimate or unknown", () => {
  const b = newBudget(10);
  const g0 = reserveBudget(b, undefined, 0.05);
  assert.equal(reReserveIfHigher(b, g0, undefined, 0.05, 0.04), g0);
  assert.equal(reReserveIfHigher(b, g0, undefined, 0.05, null), g0);
  assert.equal(reReserveIfHigher(b, g0, undefined, 0.05, 0.05), g0);
  assert.equal(b.spent, 0.05);
});

test("REQ-220/PROP-203: reReserveIfHigher denies when the higher actual would blow the cap, leaving no reservation", () => {
  const b = newBudget(0.1);
  b.spent = 0.05;
  const g0 = reserveBudget(b, undefined, 0.04);
  assert.equal(g0.allowed, true);
  const g1 = reReserveIfHigher(b, g0, undefined, 0.04, 0.09);
  assert.equal(g1.allowed, false);
  assert.equal(Math.round(b.spent * 100) / 100, 0.05);
});

test("REQ-018/PROP-010: parseBudgetLimitEnv parses a default cap, ignores junk", () => {
  assert.equal(parseBudgetLimitEnv("5"), 5);
  assert.equal(parseBudgetLimitEnv("5.00"), 5);
  assert.equal(parseBudgetLimitEnv("$2.50"), 2.5);
  assert.equal(parseBudgetLimitEnv("  10 "), 10);
  assert.equal(parseBudgetLimitEnv(undefined), null);
  assert.equal(parseBudgetLimitEnv(""), null);
  assert.equal(parseBudgetLimitEnv("abc"), null);
  assert.equal(parseBudgetLimitEnv("0"), null);
  assert.equal(parseBudgetLimitEnv("-3"), null);
});
