// Run with: npm test (tsx --test)
// PROP-PACK-003 (REQ-PACK-006). THE regression test for the ORIGINAL published-package
// crash: `npm pack` produces a REAL tarball, extracted to a fresh temp directory
// exactly as `npm install`/`npx` would lay it out — deliberately NOT `npm install -g .`,
// whose symlink-into-the-repo-checkout is what produced the FALSE-POSITIVE
// verification that let blockrun-cli 1.1.0/1.2.0 ship broken for every real npm user
// (confirmed live this session: `npm install -g .` masks the bug because the symlinked
// package can still resolve a sibling `src/` in the repo checkout; a real packed
// tarball, extracted in isolation, cannot).
//
// RED-phase note: `npm run build` must have been run before this test (same
// precondition every other Tier 2 CLI test in this repo already has) — but even a
// FRESH build reproduces the crash today, since the bug is in the SOURCE, not a stale
// build artifact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function packAndExtract(): string {
  const packDestDir = mkdtempSync(join(tmpdir(), "blockrun-cli-pack-dest-"));
  execFileSync("npm", ["pack", "--pack-destination", packDestDir], { cwd: REPO_ROOT, encoding: "utf8" });
  const tarball = readdirSync(packDestDir).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no .tgz file");
  const extractDir = mkdtempSync(join(tmpdir(), "blockrun-cli-pack-extract-"));
  execFileSync("tar", ["xzf", join(packDestDir, tarball)], { cwd: extractDir, encoding: "utf8" });
  // npm pack tarballs always extract into a top-level "package/" directory.
  return join(extractDir, "package");
}

test("PROP-PACK-003: a REAL packed-and-extracted tarball's `node dist/index.js --version` exits 0 (no sibling src/ available, unlike a repo checkout or `npm install -g .`'s symlink)", () => {
  const pkgDir = packAndExtract();
  const res = spawnSync(process.execPath, ["dist/index.js", "--version"], { cwd: pkgDir, encoding: "utf8", timeout: 15_000 });
  assert.equal(res.status, 0, `expected exit 0 — stdout: ${res.stdout}\nstderr: ${res.stderr}`);
});

test("PROP-PACK-003: a REAL packed-and-extracted tarball's `node dist/index.js commands --json` exits 0 and produces valid JSON", () => {
  const pkgDir = packAndExtract();
  const res = spawnSync(process.execPath, ["dist/index.js", "commands", "--json"], { cwd: pkgDir, encoding: "utf8", timeout: 15_000 });
  assert.equal(res.status, 0, `expected exit 0 — stdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.commands.length, 18);
});
