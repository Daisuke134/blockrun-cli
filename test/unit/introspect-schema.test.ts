// Run with: npm test (tsx --test)
// PROP-DX-001 (REQ-DX-003, -004, REQ-DX-NG-004). `introspectSchema()` does not exist
// yet (Red phase) — every test below fails on import until Phase 2b creates
// src/core/introspect-schema.ts exporting introspectSchema(schema): FlagMeta[].
//
// Anti-drift design (REQ-DX-NG-004): rather than hand-typing the expected flag list
// for all 18 commands (which would itself become a second, driftable catalog), this
// test computes the EXPECTED FlagMeta[] independently, in-test, using the SAME zod
// 4.4.3 API surface confirmed live in the blockrun-cli-agent-dx spec (field.isOptional(),
// unwrapped _def.type, ZodEnum.options, ZodDefault._def.defaultValue) directly against
// each command's REAL imported `schema` export — then asserts introspectSchema()
// produces the identical result. This still catches every real bug in the introspector
// (wrong type mapping, wrong required flag, wrong enum/default extraction) without a
// separately-maintained golden file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixturePath = fileURLToPath(new URL("./fixtures/schema-parity.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
const commands = Object.keys(fixture);

function kebabCase(snake: string): string {
  return `--${snake.replace(/_/g, "-")}`;
}

// Reference introspector — deliberately independent of the real one, built directly
// against zod's confirmed-live API surface (see spec's REQ-DX-004).
function referenceIntrospect(schema: { shape: Record<string, unknown> }) {
  return Object.entries(schema.shape).map(([fieldName, fieldRaw]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const field = fieldRaw as any;
    const required = !field.isOptional();
    let node = field;
    let defaultValue: unknown;
    let hasDefault = false;
    if (node._def?.type === "default") {
      hasDefault = true;
      defaultValue = node._def.defaultValue;
      node = node._def.innerType;
    }
    if (node._def?.type === "optional") {
      node = node._def.innerType;
    }
    let type: string;
    let enumValues: string[] | undefined;
    switch (node._def?.type) {
      case "enum":
        type = "enum";
        enumValues = node.options;
        break;
      case "string": type = "string"; break;
      case "number": type = "number"; break;
      case "boolean": type = "boolean"; break;
      case "array": type = "array"; break;
      case "object": type = "object"; break;
      default: type = "any";
    }
    const entry: Record<string, unknown> = { flag: kebabCase(fieldName), type, required };
    if (enumValues) entry.enum = enumValues;
    if (hasDefault) entry.default = defaultValue;
    return entry;
  });
}

for (const command of commands) {
  test(`PROP-DX-001: ${command}'s introspectSchema() output matches the reference introspection (fixture covers ${commands.length}/18 commands)`, async () => {
    assert.equal(commands.length, 18, "one entry per command, per the base CLI's schema-parity fixture");
    const argsMod = await import(`../../src/args/${command}.js`);
    const introspectMod = await import("../../src/core/introspect-schema.js");
    const expected = referenceIntrospect(argsMod.schema);
    const actual = introspectMod.introspectSchema(argsMod.schema);
    assert.deepEqual(
      actual.map((f: { flag: string }) => f.flag).sort(),
      expected.map((f) => f.flag as string).sort(),
      `${command}: flag name set mismatch`,
    );
    for (const exp of expected) {
      const act = actual.find((f: { flag: string }) => f.flag === exp.flag);
      assert.ok(act, `${command}: missing flag ${exp.flag}`);
      assert.equal(act.type, exp.type, `${command} ${exp.flag}: type mismatch`);
      assert.equal(act.required, exp.required, `${command} ${exp.flag}: required mismatch`);
      if (exp.enum) assert.deepEqual(act.enum, exp.enum, `${command} ${exp.flag}: enum mismatch`);
      if ("default" in exp) assert.deepEqual(act.default, exp.default, `${command} ${exp.flag}: default mismatch`);
    }
  });
}

test("PROP-DX-001: introspectSchema on video's schema surfaces duration_seconds as a required-false number with no default (spot-check against the live-verified zod API)", async () => {
  const { schema } = await import("../../src/args/video.js");
  const { introspectSchema } = await import("../../src/core/introspect-schema.js");
  const flags = introspectSchema(schema);
  const durationFlag = flags.find((f: { flag: string }) => f.flag === "--duration-seconds");
  assert.ok(durationFlag, "expected --duration-seconds in video's flag catalog");
  assert.equal(durationFlag.type, "number");
  assert.equal(durationFlag.required, false);
  assert.equal("default" in durationFlag, false);
});

test("PROP-DX-001: introspectSchema on price's schema surfaces category as a required enum with the real 5-value option set", async () => {
  const { schema } = await import("../../src/args/price.js");
  const { introspectSchema } = await import("../../src/core/introspect-schema.js");
  const flags = introspectSchema(schema);
  const categoryFlag = flags.find((f: { flag: string }) => f.flag === "--category");
  assert.ok(categoryFlag, "expected --category in price's flag catalog");
  assert.equal(categoryFlag.type, "enum");
  assert.equal(categoryFlag.required, true);
  assert.deepEqual(categoryFlag.enum, ["crypto", "fx", "commodity", "usstock", "stocks"]);
});

test("PROP-DX-001: introspectSchema on music's schema surfaces instrumental as an optional boolean with default true", async () => {
  const { schema } = await import("../../src/args/music.js");
  const { introspectSchema } = await import("../../src/core/introspect-schema.js");
  const flags = introspectSchema(schema);
  const instrumentalFlag = flags.find((f: { flag: string }) => f.flag === "--instrumental");
  assert.ok(instrumentalFlag, "expected --instrumental in music's flag catalog");
  assert.equal(instrumentalFlag.type, "boolean");
  assert.equal(instrumentalFlag.required, false);
  assert.equal(instrumentalFlag.default, true);
});
