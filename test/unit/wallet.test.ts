// Run with: npm test (tsx --test)
// PROP-101 (REQ-101–107). src/args/wallet.ts: pure buildRequest(flags) validating the
// wallet subcommand's flag surface (action/chain/budget_action/budget_amount/agent_id/
// agent_limit) against the ported zod schema, 1:1 with wallet.ts's inputSchema.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, schema } from "../../src/args/wallet.js";

test("REQ-101: action defaults to 'status' when omitted", () => {
  const r = buildRequest({});
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.action, "status");
});

test("REQ-101: rejects an unknown action (not in the enum)", () => {
  const r = buildRequest({ action: "launch-nukes" });
  assert.equal(r.ok, false);
});

test("REQ-106: delegate requires agent_id", () => {
  const r = buildRequest({ action: "delegate", agentLimit: 2 });
  assert.equal(r.ok, false);
});

test("REQ-106: delegate requires a positive agent_limit", () => {
  const r = buildRequest({ action: "delegate", agentId: "research", agentLimit: 0 });
  assert.equal(r.ok, false);
  const r2 = buildRequest({ action: "delegate", agentId: "research", agentLimit: -1 });
  assert.equal(r2.ok, false);
});

test("REQ-106: a valid delegate call passes through", () => {
  const r = buildRequest({ action: "delegate", agentId: "research", agentLimit: 2 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.agentId, "research");
    assert.equal(r.value.agentLimit, 2);
  }
});

test("REQ-106: revoke requires agent_id", () => {
  const r = buildRequest({ action: "revoke" });
  assert.equal(r.ok, false);
});

test("REQ-102: chain action accepts base/solana and omitting chain views current", () => {
  assert.equal(buildRequest({ action: "chain", chain: "solana" }).ok, true);
  assert.equal(buildRequest({ action: "chain" }).ok, true);
  assert.equal(buildRequest({ action: "chain", chain: "ethereum" }).ok, false);
});

test("REQ-103: budget action accepts set/check/clear with budget_amount", () => {
  assert.equal(buildRequest({ action: "budget", budgetAction: "set", budgetAmount: 1.5 }).ok, true);
  assert.equal(buildRequest({ action: "budget", budgetAction: "clear" }).ok, true);
});

test("schema.safeParse rejects a non-numeric agent_limit", () => {
  const parsed = schema.safeParse({ action: "delegate", agent_id: "x", agent_limit: "not-a-number" });
  assert.equal(parsed.success, false);
});
