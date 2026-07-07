// REQ-154–155. `blockrun exa`.
import { buildRequest } from "../args/exa.js";
import { estimateExaCost } from "../core/cost/exa.js";
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
  if (!built.ok) return fail(built.error, opts.json);
  const { path, body, agent_id } = built.value;

  const estimate = estimateExaCost(path, body);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    const client = getClient() as unknown as RawClient;
    const result = await client.requestWithPaymentRaw(`/v1/exa/${path}`, body);
    gated.paid.commit(estimate);
    const structured = asStructuredContent(result);
    return ok(structured, opts.json, JSON.stringify(structured, null, 2));
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json);
  } finally {
    gated.paid.release();
  }
}
