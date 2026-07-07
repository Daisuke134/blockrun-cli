// REQ-018, PROP-010. Per-invocation --budget-limit resolution (decisions.md §8).
// Pure: takes already-parsed plain arguments only, never touches process.env or
// ~/.blockrun/cli-budget.json itself — the impure shell reads process.env and passes
// the raw string in.
import { parseBudgetLimitEnv } from "./budget.js";

export function resolveInvocationBudgetLimit(
  flagValue: number | undefined,
  envValue: string | undefined,
): number | null {
  if (typeof flagValue === "number" && flagValue > 0) return flagValue;
  return parseBudgetLimitEnv(envValue);
}
