// Run with: npm test (tsx --test)
// Tier 2b, PROP-001, PROP-007 (REQ-001, REQ-002, REQ-012, REQ-013, REQ-014). Spawns the
// REAL built binary (node dist/index.js) as a subprocess — this is the ONLY tier that
// proves the tsup-built ESM bundle actually runs (bin shebang, Node ESM resolution),
// which the Tier 1/module-mock tests cannot prove. `npm run build` must be run before
// `npm test` for this file to have anything to exercise; in the Red phase dist/index.js
// does not exist yet, so every spawn here is expected to fail (ENOENT / nonzero exit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

const COMMANDS = [
  "wallet", "chat", "models", "image", "video", "realface", "music", "speech",
  "search", "exa", "markets", "price", "dex", "rpc", "defi", "modal", "phone", "surf",
];

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], { encoding: "utf8", timeout: 15_000 });
}

test("REQ-001/REQ-002/PROP-001: `blockrun --help` lists exactly the 18 subcommands", () => {
  const res = runCli(["--help"]);
  assert.equal(res.status, 0, res.stderr);
  for (const name of COMMANDS) {
    assert.match(res.stdout, new RegExp(`\\b${name}\\b`), `--help should list '${name}'`);
  }
});

for (const name of COMMANDS) {
  test(`REQ-012/REQ-013/REQ-014/PROP-007: 'blockrun ${name} --help' exits 0 with a bounded body (<=~40 lines incl. flag table)`, () => {
    const res = runCli([name, "--help"]);
    assert.equal(res.status, 0, res.stderr);
    const lines = res.stdout.split("\n").filter((l) => l.trim().length > 0);
    assert.ok(lines.length <= 60, `'${name} --help' produced ${lines.length} non-blank lines (surf/markets must summarize their catalog, not reproduce it — REQ-014)`);
  });
}
