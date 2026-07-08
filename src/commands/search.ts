// REQ-152–153. `blockrun search`.
import { buildRequest } from "../args/search.js";
import { estimateSearchCost } from "../core/cost/search.js";
import { asStructuredContent } from "../core/body.js";
import { extractErrorMessage } from "../core/errors.js";
import { getClient } from "../shell/wallet.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

type RawClient = { requestWithPaymentRaw: (endpoint: string, body: unknown) => Promise<unknown> };

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json, { code: "usage_error" });
  const { path, body, agent_id } = built.value;

  const estimate = estimateSearchCost(body);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    const client = getClient() as unknown as RawClient;
    const endpoint = path ? `/v1/search/${path}` : "/v1/search";
    const result = await client.requestWithPaymentRaw(endpoint, body);
    gated.paid.commit(estimate);
    const structured = asStructuredContent(result);
    return ok(structured, opts.json, JSON.stringify(structured, null, 2));
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json);
  } finally {
    gated.paid.release();
  }
}
