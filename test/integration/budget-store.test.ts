// Run with: npm test (tsx --test)
// PROP-011 Tier 2 (REQ-019b). Atomic write mechanics against a REAL temp directory:
// writeLedgerAtomic must write to a sibling .tmp-<pid> file then rename() over the
// target, so a concurrent reader never observes a partial write, and a simulated
// kill-before-rename leaves the ORIGINAL file byte-for-byte intact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function freshHome(): string {
  return mkdtempSync(join(tmpdir(), "blockrun-cli-budget-store-test-"));
}

test("REQ-019b: writeLedgerAtomic creates ~/.blockrun/cli-budget.json readable via readLedger", async () => {
  const home = freshHome();
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const { readLedger, writeLedgerAtomic } = await import(`../../src/shell/budget-store.js?home=${home}`);
    const { emptyLedger } = await import("../../src/core/cli-budget-schema.js");
    const ledger = emptyLedger(5, () => "2026-07-08T00:00:00.000Z");
    writeLedgerAtomic(ledger);
    const reread = readLedger();
    assert.deepEqual(reread, ledger);
  } finally {
    process.env.HOME = prevHome;
  }
});

test("REQ-019b: a write goes through a sibling .tmp-<pid> file, never a direct in-place write", async () => {
  const home = freshHome();
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const { writeLedgerAtomic } = await import(`../../src/shell/budget-store.js?home=${home}-tmpcheck`);
    const { emptyLedger } = await import("../../src/core/cli-budget-schema.js");
    writeLedgerAtomic(emptyLedger(1, () => "2026-07-08T00:00:00.000Z"));
    const dir = join(home, ".blockrun");
    const files = existsSync(dir) ? readdirSync(dir) : [];
    assert.ok(files.includes("cli-budget.json"), "final file must exist after write");
    assert.ok(!files.some((f) => f.startsWith("cli-budget.json.tmp-")), "no leftover .tmp-<pid> file after a clean write (rename() consumed it)");
  } finally {
    process.env.HOME = prevHome;
  }
});

test("REQ-019a (v4): BLOCKRUN_BUDGET_LIMIT seeds global.limit ONLY when the ledger file does not yet exist", async () => {
  const home = freshHome();
  const prevHome = process.env.HOME;
  const prevEnvLimit = process.env.BLOCKRUN_BUDGET_LIMIT;
  process.env.HOME = home;
  try {
    process.env.BLOCKRUN_BUDGET_LIMIT = "5";
    const { readLedger, writeLedgerAtomic } = await import(`../../src/shell/budget-store.js?home=${home}-noreseed`);
    // First read: no file yet -> seeded from the env var.
    const first = readLedger();
    assert.equal(first.global.limit, 5);
    writeLedgerAtomic(first); // persist it, so the file now exists on disk

    // The env var changes AFTER the file exists — REQ-019a (v4): this must have NO
    // effect on the already-persisted global.limit; only `wallet budget set/clear`
    // may change it thereafter.
    process.env.BLOCKRUN_BUDGET_LIMIT = "20";
    const second = readLedger();
    assert.equal(second.global.limit, 5, "an existing ledger file's limit must NOT be re-seeded by a later env change");
  } finally {
    process.env.HOME = prevHome;
    if (prevEnvLimit === undefined) delete process.env.BLOCKRUN_BUDGET_LIMIT;
    else process.env.BLOCKRUN_BUDGET_LIMIT = prevEnvLimit;
  }
});

test("REQ-019a: BLOCKRUN_BUDGET_LIMIT unset or non-positive seeds global.limit:null on first read (no file yet)", async () => {
  const home = freshHome();
  const prevHome = process.env.HOME;
  const prevEnvLimit = process.env.BLOCKRUN_BUDGET_LIMIT;
  process.env.HOME = home;
  try {
    delete process.env.BLOCKRUN_BUDGET_LIMIT;
    const { readLedger } = await import(`../../src/shell/budget-store.js?home=${home}-nullseed`);
    assert.equal(readLedger().global.limit, null);
  } finally {
    process.env.HOME = prevHome;
    if (prevEnvLimit === undefined) delete process.env.BLOCKRUN_BUDGET_LIMIT;
    else process.env.BLOCKRUN_BUDGET_LIMIT = prevEnvLimit;
  }
});

test("REQ-019b: a stray leftover .tmp-<pid> file (simulating a kill BEFORE rename) leaves the ORIGINAL target intact on the next read", async () => {
  const home = freshHome();
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const { readLedger, writeLedgerAtomic } = await import(`../../src/shell/budget-store.js?home=${home}-killtest`);
    const { emptyLedger, encodeBudgetLedger } = await import("../../src/core/cli-budget-schema.js");
    const original = emptyLedger(2, () => "2026-07-08T00:00:00.000Z");
    writeLedgerAtomic(original);
    const dir = join(home, ".blockrun");
    // Simulate a process killed after writing the temp file but before rename().
    writeFileSync(join(dir, "cli-budget.json.tmp-99999"), "{corrupt-partial-write");
    const reread = readLedger();
    assert.deepEqual(reread, original, "the stray temp file must never be mistaken for the real ledger");
    assert.equal(readFileSync(join(dir, "cli-budget.json"), "utf8"), encodeBudgetLedger(original));
  } finally {
    process.env.HOME = prevHome;
  }
});
