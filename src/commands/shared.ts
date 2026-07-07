// Shared paid-call gating helper for commands/<command>.ts. REQ-019c: every paid
// command checks BOTH the ephemeral per-invocation cap (the in-memory BudgetState
// passed into run(), REQ-018) AND the persisted ~/.blockrun/cli-budget.json ledger
// (REQ-019), independently, BEFORE any network call — and writes the persisted
// ledger back after a successful settle.
import { readLedger, writeLedgerAtomic } from "../shell/budget-store.js";
import { checkPersistedBudget, applyPersistedSpend } from "../core/cli-budget-schema.js";
import { reserveBudget, reReserveIfHigher, recordActualSpend } from "../core/budget.js";
import type { BudgetState } from "../types.js";
import { fail } from "../core/render.js";
import type { CommandOutcome } from "../core/render.js";

const nowIso = () => new Date().toISOString();

const GATE_HINT = "Use blockrun wallet --action report to see usage or --action delegate to increase agent budget.";

export interface PaidGate {
  release: () => void;
  commit: (actualUsd?: number | null) => void;
  /**
   * REQ-220: re-validate a HIGHER real quote (from a 402 challenge) against
   * BOTH the ephemeral per-invocation cap and the persisted ledger cap BEFORE
   * signing — used by video/music/speech/realface/Solana-image, whose real
   * price is only known after the quote. Swaps the held reservation to the
   * real amount when it still fits; returns {allowed:false} (holding nothing
   * extra) when it would exceed either cap, so the caller can abort before
   * ever calling createPaymentPayload/createSolanaPaymentPayload.
   */
  reverify: (quotedUsd: number | null) => { allowed: boolean; reason?: string };
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
    return { ok: false, outcome: fail(`${persistedCheck.reason}. ${GATE_HINT}`, json) };
  }

  let gate = reserveBudget(budget, agentId, estimate);
  if (!gate.allowed) {
    return { ok: false, outcome: fail(`${gate.reason}. ${GATE_HINT}`, json) };
  }
  let heldAmount = estimate;

  return {
    ok: true,
    paid: {
      release: () => gate.release(),
      commit: (actualUsd) => {
        recordActualSpend(budget, actualUsd, heldAmount, agentId);
        writeLedgerAtomic(applyPersistedSpend(ledger, agentId, actualUsd, heldAmount, nowIso));
      },
      reverify: (quotedUsd) => {
        if (typeof quotedUsd !== "number" || !Number.isFinite(quotedUsd) || quotedUsd <= heldAmount) {
          return { allowed: true };
        }
        const persisted = checkPersistedBudget(ledger, agentId, quotedUsd);
        if (!persisted.allowed) {
          return { allowed: false, reason: `${persisted.reason}. ${GATE_HINT}` };
        }
        const newGate = reReserveIfHigher(budget, gate, agentId, heldAmount, quotedUsd);
        if (!newGate.allowed) {
          return { allowed: false, reason: `${newGate.reason}. ${GATE_HINT}` };
        }
        gate = newGate;
        heldAmount = quotedUsd;
        return { allowed: true };
      },
    },
  };
}
