// Run with: npm test (tsx --test)
// Tier 0+1, PROP-002 (REQ-003, REQ-005). Each src/args/<command>.ts exports its raw zod
// object `schema` verbatim from the clone's inputSchema (field names, enums, defaults,
// optionality — decisions.md §3). This table-driven test safeParse()s one valid and one
// deliberately-wrong-typed example per command, transcribed from each tool's own
// description block in the blockrun-mcp clone (fixtures/schema-parity.json is the
// checked-in Tier 0 fixture; this file is the Tier 1 test that exercises it).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixturePath = fileURLToPath(new URL("./fixtures/schema-parity.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, { valid: unknown; invalid: unknown }>;

const commands = Object.keys(fixture);

// Fixture completeness (18 commands) is asserted INSIDE the first per-command test
// below via commands.length, rather than as its own standalone assertion — a
// standalone "the fixture has 18 keys" test needs no src/ import and would trivially
// pass before any implementation exists, which the Red phase must not allow (every new
// test here must fail until src/args/*.ts exists per the TDD-Red contract).
for (const command of commands) {
  test(`PROP-002: ${command} schema.safeParse() accepts the documented valid example (fixture covers ${commands.length}/18 commands)`, async () => {
    assert.equal(commands.length, 18, "one valid+invalid example per command, per verification-architecture.md §3");
    const mod = await import(`../../src/args/${command}.js`);
    const result = mod.schema.safeParse(fixture[command].valid);
    assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error?.issues));
  });

  test(`PROP-002: ${command} schema.safeParse() rejects the documented invalid example`, async () => {
    const mod = await import(`../../src/args/${command}.js`);
    const result = mod.schema.safeParse(fixture[command].invalid);
    assert.equal(result.success, false, `${command} schema should reject its invalid fixture`);
  });
}
