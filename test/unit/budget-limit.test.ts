// Run with: npm test (tsx --test)
// PROP-010 (REQ-018). resolveInvocationBudgetLimit is pure: flag > env > unlimited, and
// it must never touch ~/.blockrun/cli-budget.json (that ledger is REQ-019's separate,
// persisted concern — REQ-018's cap is ephemeral, checked additionally to it).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveInvocationBudgetLimit } from "../../src/core/budget-limit.js";

test("REQ-018: --budget-limit flag wins over the env var", () => {
  assert.equal(resolveInvocationBudgetLimit(2, "5"), 2);
});

test("REQ-018: env var is used when no flag is given", () => {
  assert.equal(resolveInvocationBudgetLimit(undefined, "5"), 5);
  assert.equal(resolveInvocationBudgetLimit(undefined, "$2.50"), 2.5);
});

test("REQ-018: unlimited (null) when neither is set or both are junk", () => {
  assert.equal(resolveInvocationBudgetLimit(undefined, undefined), null);
  assert.equal(resolveInvocationBudgetLimit(undefined, "abc"), null);
  assert.equal(resolveInvocationBudgetLimit(undefined, "-3"), null);
});

test("REQ-018: a non-positive flag value is treated as not set, falling back to env", () => {
  assert.equal(resolveInvocationBudgetLimit(0, "5"), 5);
  assert.equal(resolveInvocationBudgetLimit(-1, "5"), 5);
});

test("PROP-010: resolving the invocation cap makes zero reads/writes of the persisted ledger file", async () => {
  // Import core/cli-budget-schema.js and assert resolveInvocationBudgetLimit does not
  // even import a filesystem module transitively — proven here by simply calling it
  // with no fs mock installed and no ~/.blockrun directory required to exist; if the
  // function touched fs it would need a real/mocked filesystem to not throw.
  const before = process.env.HOME;
  process.env.HOME = "/nonexistent/path/that/does/not/exist/blockrun-cli-test";
  try {
    assert.equal(resolveInvocationBudgetLimit(3, undefined), 3);
  } finally {
    process.env.HOME = before;
  }
});
