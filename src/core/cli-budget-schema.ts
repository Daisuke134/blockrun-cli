// REQ-019/REQ-019a/REQ-019b/REQ-019c (PROP-011). Pure schema + encode/decode +
// BudgetState-bridge functions for the persisted ~/.blockrun/cli-budget.json ledger
// (decisions.md §9). Zero fs access — the actual file I/O lives in shell/budget-store.ts.
import type { BudgetState, AgentBudget } from "../types.js";
import { checkBudget, recordActualSpend } from "./budget.js";

export interface AgentBudgetEntry {
  limit: number;
  spent: number;
  calls: number;
}

export interface CliBudgetLedger {
  version: 1;
  global: { limit: number | null; spent: number; calls: number };
  agents: Record<string, AgentBudgetEntry>;
  updatedAt: string;
}

export function emptyLedger(seedLimit: number | null, now: () => string): CliBudgetLedger {
  return {
    version: 1,
    global: { limit: seedLimit, spent: 0, calls: 0 },
    agents: {},
    updatedAt: now(),
  };
}

export function encodeBudgetLedger(ledger: CliBudgetLedger): string {
  return JSON.stringify(ledger);
}

export function decodeBudgetLedger(raw: string): CliBudgetLedger {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("cli-budget.json: not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("cli-budget.json: expected an object");
  }
  const p = parsed as Record<string, unknown>;
  if (p.version !== 1) {
    throw new Error(`cli-budget.json: unsupported version ${JSON.stringify(p.version)} (expected 1)`);
  }
  const global = p.global as Record<string, unknown> | undefined;
  if (!global || typeof global.spent !== "number" || typeof global.calls !== "number") {
    throw new Error("cli-budget.json: malformed 'global' field");
  }
  if (!p.agents || typeof p.agents !== "object") {
    throw new Error("cli-budget.json: malformed 'agents' field");
  }
  if (typeof p.updatedAt !== "string") {
    throw new Error("cli-budget.json: malformed 'updatedAt' field");
  }
  return {
    version: 1,
    global: {
      limit: typeof global.limit === "number" ? global.limit : null,
      spent: global.spent as number,
      calls: global.calls as number,
    },
    agents: p.agents as Record<string, AgentBudgetEntry>,
    updatedAt: p.updatedAt,
  };
}

export function toBudgetState(ledger: CliBudgetLedger): BudgetState {
  const agents = new Map<string, AgentBudget>();
  for (const [id, entry] of Object.entries(ledger.agents)) {
    agents.set(id, { limit: entry.limit, spent: entry.spent, calls: entry.calls });
  }
  return {
    limit: ledger.global.limit,
    spent: ledger.global.spent,
    calls: ledger.global.calls,
    agents,
  };
}

export function fromBudgetState(state: BudgetState, updatedAt: string): CliBudgetLedger {
  const agents: Record<string, AgentBudgetEntry> = {};
  for (const [id, entry] of state.agents.entries()) {
    agents[id] = { limit: entry.limit, spent: entry.spent, calls: entry.calls };
  }
  return {
    version: 1,
    global: { limit: state.limit, spent: state.spent, calls: state.calls },
    agents,
    updatedAt,
  };
}

export function checkPersistedBudget(
  ledger: CliBudgetLedger,
  agentId: string | undefined,
  estimate: number,
): { allowed: boolean; reason?: string } {
  const state = toBudgetState(ledger);
  return checkBudget(state, agentId, estimate);
}

export function applyPersistedSpend(
  ledger: CliBudgetLedger,
  agentId: string | undefined,
  actualUsd: number | null | undefined,
  estimate: number,
  now: () => string,
): CliBudgetLedger {
  const state = toBudgetState(ledger);
  recordActualSpend(state, actualUsd, estimate, agentId);
  return fromBudgetState(state, now());
}
