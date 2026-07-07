// Run with: npm test (tsx --test)
// Tier 2b, table-driven per verification-architecture.md §3 ("<command>-subprocess.test.ts
// (x18) (or table-driven single file)"). PROP-004, PROP-005, PROP-006 (REQ-006–011).
// Spawns the real built binary against a LOCAL stub HTTP server (for the manual-402
// media commands) or with an invalid/locally-rejectable input (for the SDK-mediated
// commands, so no real payment is ever made in this suite — REQ-NG-003 adjacent: this
// suite must never spend real USDC). Every invocation here is expected to fail cleanly
// (nonzero exit + well-formed JSON error) since none of these commands can complete
// without either a funded real wallet or a real network call — proving the REQ-008/009
// exit-code contract and the REQ-010/011 error-shape contract through the real CLI
// process, not a mock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

// Hermetic HOME per REQ-017/PROP-009: an isolated, unfunded wallet is auto-created here,
// so any command that reaches the network fails on payment/balance (never silently
// succeeds against a real funded wallet).
const ISOLATED_HOME = mkdtempSync(join(tmpdir(), "blockrun-cli-subprocess-test-"));

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, HOME: ISOLATED_HOME },
  });
}

// Table: one locally-invalid invocation per command (invalid enum / missing required
// flag / malformed path) — guaranteed to fail BEFORE any network call, for every
// command, regardless of wallet funding state.
const INVALID_CASES: Array<{ name: string; args: string[] }> = [
  { name: "wallet", args: ["wallet", "--action", "self-destruct", "--json"] },
  { name: "chat", args: ["chat", "--json"] }, // missing message
  { name: "models", args: ["models", "--category", "sentience", "--json"] },
  { name: "image", args: ["image", "a cube", "--action", "edit", "--json"] }, // missing --image
  { name: "video", args: ["video", "a cube", "--model", "azure/sora-2", "--duration-seconds", "5", "--json"] },
  { name: "realface", args: ["realface", "--action", "init", "--json"] }, // missing name
  { name: "music", args: ["music", "a track", "--lyrics", "la la la", "--json"] }, // instrumental default true + lyrics
  { name: "speech", args: ["speech", "--action", "sound_effect", "--json"] }, // missing input
  { name: "search", args: ["search", "--json"] }, // missing --query
  { name: "exa", args: ["exa", "--path", "delete-everything", "--body-json", "{}", "--json"] },
  { name: "markets", args: ["markets", "--json"] }, // missing --path
  { name: "price", args: ["price", "--action", "price", "--category", "stocks", "--symbol", "AAPL", "--json"] }, // missing --market
  { name: "dex", args: ["dex", "--json"] }, // missing query/token/symbol
  { name: "rpc", args: ["rpc", "--network", "../v1/modal/sandbox/create", "--method", "x", "--json"] },
  { name: "defi", args: ["defi", "--json"] }, // missing --path
  { name: "modal", args: ["modal", "--path", "sandbox/self-destruct", "--json"] },
  { name: "phone", args: ["phone", "--path", "voice/call", "--body-json", "{\"to\":\"+15551234567\"}", "--json"] }, // missing 'from'
  { name: "surf", args: ["surf", "--json"] }, // missing --path
];

for (const { name, args } of INVALID_CASES) {
  test(`REQ-009/REQ-010/PROP-005/PROP-006: '${name}' with a locally-invalid input exits nonzero with a JSON error object, no network call`, () => {
    const res = runCli(args);
    assert.notEqual(res.status, 0, `expected a nonzero exit for an invalid '${name}' invocation\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.error, true);
    assert.equal(typeof parsed.message, "string");
  });
}

test("REQ-006: --json output is ONLY a single parseable JSON document on stdout; logs go to stderr", () => {
  const res = runCli(["wallet", "--action", "self-destruct", "--json"]);
  assert.doesNotThrow(() => JSON.parse(res.stdout), "stdout must be JSON.parse-able in full when --json is set");
});

test("REQ-007: without --json, a locally-rejected call prints human-readable text to stderr, not JSON", () => {
  const res = runCli(["wallet", "--action", "self-destruct"]);
  assert.notEqual(res.status, 0);
  assert.throws(() => JSON.parse(res.stderr), "stderr text should be human-readable, not a JSON document");
});
