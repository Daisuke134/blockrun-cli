// REQ-101–107. Pure buildRequest for `blockrun wallet`, mirroring blockrun-mcp's
// src/tools/wallet.ts inputSchema 1:1. wallet's own agent_id/agent_limit fields are
// scoped to delegate/revoke/report (REQ-104) — distinct from REQ-022's cross-cutting
// agent_id convention (wallet is explicitly excluded from that list).
import { z } from "zod";
import type { BuildResult } from "./shared.js";

const ACTIONS = ["status", "deposit", "setup", "qr", "chain", "budget", "delegate", "revoke", "report"] as const;

export const schema = z.object({
  action: z.enum(ACTIONS).optional().default("status"),
  chain: z.enum(["base", "solana"]).optional(),
  budget_action: z.enum(["set", "check", "clear"]).optional(),
  budget_amount: z.number().optional(),
  agent_id: z.string().optional(),
  agent_limit: z.number().optional(),
});

export interface WalletRequest {
  action: (typeof ACTIONS)[number];
  chain?: "base" | "solana";
  budgetAction?: "set" | "check" | "clear";
  budgetAmount?: number;
  agentId?: string;
  agentLimit?: number;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<WalletRequest> {
  const action = (flags.action ?? "status") as string;
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: `--action must be one of: ${ACTIONS.join(", ")}` };
  }
  if (flags.chain !== undefined && flags.chain !== "base" && flags.chain !== "solana") {
    return { ok: false, error: "--chain must be 'base' or 'solana'" };
  }
  if (action === "delegate") {
    if (typeof flags.agentId !== "string" || flags.agentId.length === 0) {
      return { ok: false, error: "--agent-id is required for --action delegate" };
    }
    if (typeof flags.agentLimit !== "number" || flags.agentLimit <= 0) {
      return { ok: false, error: "--agent-limit (a positive number) is required for --action delegate" };
    }
  }
  if (action === "revoke" && (typeof flags.agentId !== "string" || flags.agentId.length === 0)) {
    return { ok: false, error: "--agent-id is required for --action revoke" };
  }

  const value: WalletRequest = { action: action as WalletRequest["action"] };
  if (typeof flags.chain === "string") value.chain = flags.chain as "base" | "solana";
  if (typeof flags.budgetAction === "string") value.budgetAction = flags.budgetAction as WalletRequest["budgetAction"];
  if (typeof flags.budgetAmount === "number") value.budgetAmount = flags.budgetAmount;
  if (typeof flags.agentId === "string") value.agentId = flags.agentId;
  if (typeof flags.agentLimit === "number") value.agentLimit = flags.agentLimit;
  return { ok: true, value };
}
