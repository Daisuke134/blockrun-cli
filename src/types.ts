// Verbatim port of blockrun-mcp's src/types.ts (verification-architecture.md §1.1).
export interface AgentBudget {
  limit: number;
  spent: number;
  calls: number;
}

export interface BudgetState {
  limit: number | null;
  spent: number;
  calls: number;
  agents: Map<string, AgentBudget>;
}
