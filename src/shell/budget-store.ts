// Impure shell: reads/atomically writes ~/.blockrun/cli-budget.json (REQ-019/019a/019b),
// wrapping the pure core/cli-budget-schema.ts encode/decode functions around the actual
// fs calls. Resolves the path via os.homedir() at CALL time (not cached at module load)
// so a test that changes process.env.HOME between calls is honored (decisions.md §9).
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emptyLedger, decodeBudgetLedger, encodeBudgetLedger, type CliBudgetLedger } from "../core/cli-budget-schema.js";
import { parseBudgetLimitEnv } from "../core/budget.js";

function ledgerDir(): string {
  return join(homedir(), ".blockrun");
}

function ledgerPath(): string {
  return join(ledgerDir(), "cli-budget.json");
}

const now = () => new Date().toISOString();

/**
 * Reads the persisted ledger. WHEN the file does not yet exist, seeds
 * global.limit from BLOCKRUN_BUDGET_LIMIT (REQ-019a) — this is the ONLY place that
 * reads that env var, and only on this first-ever read; once the file exists, a
 * later change to the env var has NO effect (REQ-019a v4).
 */
export function readLedger(): CliBudgetLedger {
  const path = ledgerPath();
  if (!existsSync(path)) {
    return emptyLedger(parseBudgetLimitEnv(process.env.BLOCKRUN_BUDGET_LIMIT), now);
  }
  const raw = readFileSync(path, "utf8");
  return decodeBudgetLedger(raw);
}

/**
 * Atomically writes the ledger: write to a sibling `.tmp-<pid>` file in the same
 * directory, then rename() over the target (REQ-019b) — a concurrent reader never
 * observes a partial write, and a stray leftover temp file from a killed process
 * never gets mistaken for the real ledger (readLedger only ever reads the exact
 * target path).
 */
export function writeLedgerAtomic(ledger: CliBudgetLedger): void {
  const dir = ledgerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const target = ledgerPath();
  const tmpPath = `${target}.tmp-${process.pid}`;
  writeFileSync(tmpPath, encodeBudgetLedger(ledger), { mode: 0o600 });
  renameSync(tmpPath, target);
}
