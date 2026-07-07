// REQ-166–169, REQ-200, REQ-201, REQ-022. Pure buildRequest for `blockrun rpc`.
// estimateRpcCost is a direct port of rpc.ts's inline RPC_PRICE_USD * batchCount math
// (verification-architecture.md §1.1 note: no dedicated cost/rpc.ts module).
import { z } from "zod";
import { coerceBody } from "../core/body.js";
import { isValidNetworkSlug } from "../core/path-safety.js";
import type { BuildResult } from "./shared.js";

const RPC_PRICE_USD = 0.002;

export function estimateRpcCost(body: unknown): number {
  const batchCount = Array.isArray(body) ? Math.max(body.length, 1) : 1;
  return RPC_PRICE_USD * batchCount;
}

export const schema = z
  .object({
    network: z.string(),
    method: z.string().optional(),
    params: z.any().optional(),
    body: z.any().optional(),
    agent_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const cleanNetwork = data.network.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
    if (!isValidNetworkSlug(cleanNetwork)) {
      ctx.addIssue({ code: "custom", path: ["network"], message: "network must be a well-formed chain slug (letters, digits, hyphens only)" });
    }
  });

export interface RpcRequest {
  network: string;
  body: unknown;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<RpcRequest> {
  const network = flags.network;
  if (typeof network !== "string" || network.length === 0) {
    return { ok: false, error: "--network is required" };
  }
  const cleanNetwork = network.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!isValidNetworkSlug(cleanNetwork)) {
    return { ok: false, error: `Invalid network '${network}'. Use a chain slug like 'ethereum', 'base', or 'solana'.` };
  }

  let body = coerceBody(flags.body);
  const method = flags.method;
  const hasMethod = typeof method === "string" && method.length > 0;
  if (body !== undefined && hasMethod) {
    return { ok: false, error: "--method conflicts with --body — provide exactly one of --method (with optional --params) or a full JSON-RPC --body." };
  }
  if (body === undefined) {
    if (!hasMethod) {
      return { ok: false, error: "Provide either --method (with optional --params) or a full JSON-RPC --body." };
    }
    body = { jsonrpc: "2.0", id: 1, method, params: flags.params ?? [] };
  }

  const value: RpcRequest = { network: cleanNetwork, body };
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
