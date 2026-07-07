// Shared paid-call gating helper for commands/<command>.ts. REQ-019c: every paid
// command checks BOTH the ephemeral per-invocation cap (the in-memory BudgetState
// passed into run(), REQ-018) AND the persisted ~/.blockrun/cli-budget.json ledger
// (REQ-019), independently, BEFORE any network call — and writes the persisted
// ledger back after a successful settle.
import { readLedger, writeLedgerAtomic } from "../shell/budget-store.js";
import { checkPersistedBudget, applyPersistedSpend } from "../core/cli-budget-schema.js";
import { reserveBudget, recordActualSpend } from "../core/budget.js";
import type { BudgetState } from "../types.js";
import { fail } from "../core/render.js";
import type { CommandOutcome } from "../core/render.js";

const nowIso = () => new Date().toISOString();

export interface PaidGate {
  release: () => void;
  commit: (actualUsd?: number | null) => void;
}

export type GateResult =
  | { ok: true; paid: PaidGate }
  | { ok: false; outcome: CommandOutcome };

export function gatePaidCall(
  budget: BudgetState,
  agentId: string | undefined,
  estimate: number,
  json: boolean,
): GateResult {
  const ledger = readLedger();
  const persistedCheck = checkPersistedBudget(ledger, agentId, estimate);
  if (!persistedCheck.allowed) {
    return {
      ok: false,
      outcome: fail(`${persistedCheck.reason}. Use blockrun wallet --action report to see usage or --action delegate to increase agent budget.`, json),
    };
  }

  const gate = reserveBudget(budget, agentId, estimate);
  if (!gate.allowed) {
    return {
      ok: false,
      outcome: fail(`${gate.reason}. Use blockrun wallet --action report to see usage or --action delegate to increase agent budget.`, json),
    };
  }

  return {
    ok: true,
    paid: {
      release: gate.release,
      commit: (actualUsd) => {
        recordActualSpend(budget, actualUsd, estimate, agentId);
        writeLedgerAtomic(applyPersistedSpend(ledger, agentId, actualUsd, estimate, nowIso));
      },
    },
  };
}
