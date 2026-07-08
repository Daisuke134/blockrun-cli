// Run with: npm test (tsx --test)
// PROP-DX-004 (REQ-DX-003's costModel). Does not exist yet (Red phase) — every test
// fails on import until Phase 2b creates src/core/cost-model.ts. Ground truth (verified
// live via `grep -c gatePaidCall src/commands/*.ts` during spec-writing, per
// behavioral-spec.md REQ-DX-001): wallet/models/dex call gatePaidCall 0 times (free);
// the other 15 call it exactly 2 times each (paid).
import { test } from "node:test";
import assert from "node:assert/strict";

const FREE_COMMANDS = ["wallet", "models", "dex"];
const PAID_COMMANDS = [
  "chat", "image", "video", "realface", "music", "speech", "search", "exa",
  "markets", "price", "rpc", "defi", "modal", "phone", "surf",
];

test("PROP-DX-004: exactly 18 commands are classified, 3 free + 15 paid", () => {
  assert.equal(FREE_COMMANDS.length + PAID_COMMANDS.length, 18);
});

for (const name of FREE_COMMANDS) {
  test(`PROP-DX-004: ${name}'s costModel is "free" (zero gatePaidCall calls, verified live)`, async () => {
    const mod = await import("../../src/core/cost-model.js");
    assert.equal(mod.COMMAND_COST_MODEL[name], "free");
  });
}

for (const name of PAID_COMMANDS) {
  test(`PROP-DX-004: ${name}'s costModel is "paid" (2 gatePaidCall calls, verified live)`, async () => {
    const mod = await import("../../src/core/cost-model.js");
    assert.equal(mod.COMMAND_COST_MODEL[name], "paid");
  });
}
