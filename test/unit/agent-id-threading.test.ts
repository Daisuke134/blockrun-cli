// Run with: npm test (tsx --test)
// PROP-205 (REQ-022). Table-driven over the 15 commands whose source inputSchema
// declares agent_id (all 18 minus wallet/models/dex, per REQ-022). Asserts buildRequest
// threads --agent-id verbatim into the request when passed, and OMITS the key entirely
// (not agent_id: undefined) when not passed.
import { test } from "node:test";
import assert from "node:assert/strict";

const CASES: Array<{ command: string; minimalFlags: Record<string, unknown> }> = [
  { command: "chat", minimalFlags: { message: "hi" } },
  { command: "image", minimalFlags: { prompt: "a cube" } },
  { command: "video", minimalFlags: { prompt: "a cube spinning" } },
  { command: "realface", minimalFlags: { action: "enroll", name: "Alice", imageUrl: "https://x/a.png", groupId: "legacy_rf_1" } },
  { command: "music", minimalFlags: { prompt: "lo-fi beats" } },
  { command: "speech", minimalFlags: { input: "hi" } },
  { command: "search", minimalFlags: { query: "ethereum" } },
  { command: "exa", minimalFlags: { path: "answer", body: { query: "x" } } },
  { command: "markets", minimalFlags: { path: "polymarket/events" } },
  { command: "price", minimalFlags: { action: "price", category: "crypto", symbol: "BTC-USD" } },
  { command: "rpc", minimalFlags: { network: "base", method: "eth_blockNumber" } },
  { command: "defi", minimalFlags: { path: "chains" } },
  { command: "modal", minimalFlags: { path: "sandbox/create", body: {} } },
  { command: "phone", minimalFlags: { path: "phone/numbers/list", body: {} } },
  { command: "surf", minimalFlags: { path: "market/price", params: { symbol: "BTC" } } },
];

// Fixture completeness (15 commands) is asserted INSIDE the first per-command test
// below, not as its own standalone assertion — a standalone "the fixture has 15
// entries" test needs no src/ import and would trivially pass before any
// implementation exists, which the Red phase must not allow.
for (const { command, minimalFlags } of CASES) {
  test(`REQ-022/PROP-205: ${command} threads agent_id verbatim when --agent-id is passed (fixture covers ${CASES.length}/15 commands)`, async () => {
    assert.equal(CASES.length, 15);
    const mod = await import(`../../src/args/${command}.js`);
    const r = mod.buildRequest({ ...minimalFlags, agentId: "research" });
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    if (r.ok) assert.equal(r.value.agent_id, "research");
  });

  test(`REQ-022/PROP-205: ${command} OMITS agent_id entirely (not agent_id:undefined) when --agent-id is not passed`, async () => {
    const mod = await import(`../../src/args/${command}.js`);
    const r = mod.buildRequest({ ...minimalFlags });
    assert.equal(r.ok, true, r.ok ? "" : r.error);
    if (r.ok) assert.equal(Object.prototype.hasOwnProperty.call(r.value, "agent_id"), false);
  });
}
