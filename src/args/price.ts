// REQ-159–162, REQ-022. Pure buildRequest + isPaidPriceCall for `blockrun price`.
import { z } from "zod";
import type { BuildResult } from "./shared.js";

const CATEGORY = z.enum(["crypto", "fx", "commodity", "usstock", "stocks"]);
const MARKET = z.enum(["us", "hk", "jp", "kr", "gb", "de", "fr", "nl", "ie", "lu", "cn", "ca"]);
const RESOLUTION = z.enum(["1", "5", "15", "60", "240", "D", "W", "M"]);
const SESSION = z.enum(["pre", "post", "on"]);
const ACTION = z.enum(["price", "history", "list"]);

export const schema = z
  .object({
    action: ACTION,
    category: CATEGORY,
    symbol: z.string().optional(),
    market: MARKET.optional(),
    session: SESSION.optional(),
    resolution: RESOLUTION.optional(),
    from: z.number().optional(),
    to: z.number().optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().max(2000).optional(),
    agent_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === "stocks" && !data.market) {
      ctx.addIssue({ code: "custom", message: "market is required when category='stocks'" });
    }
  });

export function isPaidPriceCall(action: "price" | "history" | "list", category: string): boolean {
  return action !== "list" && (category === "stocks" || category === "usstock");
}

export interface PriceRequest {
  action: "price" | "history" | "list";
  category: string;
  symbol?: string;
  market?: string;
  session?: string;
  resolution?: string;
  from?: number;
  to?: number;
  query?: string;
  limit?: number;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<PriceRequest> {
  const action = (flags.action ?? "price") as string;
  if (!["price", "history", "list"].includes(action)) {
    return { ok: false, error: "--action must be one of: price, history, list" };
  }
  const category = flags.category;
  if (typeof category !== "string" || category.length === 0) {
    return { ok: false, error: "--category is required" };
  }
  if (category === "stocks" && typeof flags.market !== "string") {
    return { ok: false, error: "--market is required when --category=stocks" };
  }
  if (action === "price" && typeof flags.symbol !== "string") {
    return { ok: false, error: "--symbol is required for action=price" };
  }
  if (action === "history") {
    if (typeof flags.symbol !== "string") return { ok: false, error: "--symbol is required for action=history" };
    if (flags.from === undefined) return { ok: false, error: "--from is required for action=history" };
  }

  const value: PriceRequest = { action: action as "price" | "history" | "list", category };
  if (typeof flags.symbol === "string") value.symbol = flags.symbol;
  if (typeof flags.market === "string") value.market = flags.market;
  if (typeof flags.session === "string") value.session = flags.session;
  if (typeof flags.resolution === "string") value.resolution = flags.resolution;
  if (typeof flags.from === "number") value.from = flags.from;
  if (typeof flags.to === "number") value.to = flags.to;
  if (typeof flags.query === "string") value.query = flags.query;
  if (typeof flags.limit === "number") value.limit = flags.limit;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
