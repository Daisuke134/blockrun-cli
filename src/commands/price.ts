// REQ-159–162. `blockrun price`.
import { buildRequest, isPaidPriceCall } from "../args/price.js";
import { asStructuredContent } from "../core/body.js";
import { extractErrorMessage } from "../core/errors.js";
import { getChain, getPriceClient } from "../shell/wallet.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json);
  const { action, category, symbol, market, session, resolution, from, to, query, limit, agent_id } = built.value;

  const paid = isPaidPriceCall(action, category);
  if (paid && getChain() !== "base") {
    return fail(
      "Paid stock price/history calls currently settle on Base only. Switch BlockRun to Base (blockrun wallet --action chain --chain base) and fund the Base wallet with USDC.",
      opts.json,
      { chain: getChain() },
    );
  }

  const estimate = paid ? 0.001 : 0;
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    const priceClient = getPriceClient(paid);
    let result: unknown;
    if (action === "price") {
      if (!symbol) throw new Error("symbol is required for action='price'");
      result = await priceClient.price(category as never, symbol, { market: market as never, session: session as never });
    } else if (action === "history") {
      if (!symbol) throw new Error("symbol is required for action='history'");
      if (from === undefined) throw new Error("from (unix seconds) is required for action='history'");
      result = await priceClient.history(category as never, symbol, {
        market: market as never,
        session: session as never,
        resolution: (resolution ?? "D") as never,
        from,
        to,
      });
    } else {
      result = await priceClient.listSymbols(category as never, { market: market as never, query, limit });
    }
    if (estimate > 0) gated.paid.commit(estimate);
    const structured = asStructuredContent(result);
    return ok(structured, opts.json, JSON.stringify(structured, null, 2));
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json, { chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
