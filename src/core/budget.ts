// Verbatim port of blockrun-mcp's src/utils/budget.ts (verification-architecture.md §1.1).
import type { BudgetState } from "../types.js";

const EPSILON = 1e-9;

function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount >= 1 ? 2 : 4)}`;
}

export function checkBudget(
  budget: BudgetState,
  agentId?: string,
  estimatedCost: number = 0.001,
): { allowed: boolean; reason?: string } {
  const cost = Math.max(0, estimatedCost);

  if (cost > 0 && budget.limit !== null && budget.spent + cost > budget.limit + EPSILON) {
    const remaining = Math.max(0, budget.limit - budget.spent);
    return {
      allowed: false,
      reason: `Global budget limit ${formatUsd(budget.limit)} would be exceeded (${formatUsd(budget.spent)} spent, ${formatUsd(remaining)} remaining, next call estimated ${formatUsd(cost)})`,
    };
  }

  if (agentId) {
    const agentBudget = budget.agents.get(agentId);
    if (cost > 0 && agentBudget && agentBudget.spent + cost > agentBudget.limit + EPSILON) {
      const remaining = Math.max(0, agentBudget.limit - agentBudget.spent);
      return {
        allowed: false,
        reason: `Agent "${agentId}" budget ${formatUsd(agentBudget.limit)} would be exceeded (${formatUsd(agentBudget.spent)} spent, ${formatUsd(remaining)} remaining, next call estimated ${formatUsd(cost)})`,
      };
    }
  }

  return { allowed: true };
}

export function reserveBudget(
  budget: BudgetState,
  agentId?: string,
  estimatedCost: number = 0.001,
): { allowed: boolean; reason?: string; release: () => void } {
  const check = checkBudget(budget, agentId, estimatedCost);
  if (!check.allowed) return { allowed: false, reason: check.reason, release: () => {} };

  const cost = Math.max(0, estimatedCost);
  budget.spent += cost;
  const agentBudget = agentId ? budget.agents.get(agentId) : undefined;
  if (agentBudget) agentBudget.spent += cost;

  let released = false;
  return {
    allowed: true,
    release: () => {
      if (released) return;
      released = true;
      budget.spent -= cost;
      if (agentBudget) agentBudget.spent -= cost;
    },
  };
}

type Reservation = { allowed: boolean; reason?: string; release: () => void };

export function reReserveIfHigher(
  budget: BudgetState,
  gate: Reservation,
  agentId: string | undefined,
  estimate: number,
  actualUsd: number | null | undefined,
): Reservation {
  if (typeof actualUsd !== "number" || !Number.isFinite(actualUsd) || actualUsd <= estimate) {
    return gate;
  }
  gate.release();
  return reserveBudget(budget, agentId, actualUsd);
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export function recordSpending(budget: BudgetState, cost: number, agentId?: string): void {
  budget.spent += cost;
  budget.calls += 1;

  if (agentId) {
    const agentBudget = budget.agents.get(agentId);
    if (agentBudget) {
      agentBudget.spent += cost;
      agentBudget.calls += 1;
    }
  }
}

export function amountToUsd(amount: unknown): number | null {
  const n =
    typeof amount === "string" ? Number(amount)
    : typeof amount === "number" ? amount
    : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 1_000_000;
}

export function recordActualSpend(
  budget: BudgetState,
  actualUsd: number | null | undefined,
  estimate: number,
  agentId?: string,
): void {
  const cost =
    typeof actualUsd === "number" && Number.isFinite(actualUsd) && actualUsd > 0
      ? actualUsd
      : Math.max(0, estimate);
  recordSpending(budget, cost, agentId);
}

export function parseBudgetLimitEnv(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim().replace(/^\$/, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
