// REQ-175–177. `blockrun phone`.
import { buildRequest } from "../args/phone.js";
import { estimatePhoneCost } from "../core/cost/phone.js";
import { asStructuredContent } from "../core/body.js";
import { extractErrorMessage } from "../core/errors.js";
import { getClient } from "../shell/wallet.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

type RawClient = {
  getWithPaymentRaw: (endpoint: string) => Promise<unknown>;
  requestWithPaymentRaw: (endpoint: string, body: unknown) => Promise<unknown>;
};

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json, { code: "usage_error" });
  const { path, body, agent_id } = built.value;

  const estimate = estimatePhoneCost(path, body !== undefined);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    const client = getClient() as unknown as RawClient;
    const endpoint = `/v1/${path}`;
    const result = body !== undefined
      ? await client.requestWithPaymentRaw(endpoint, body)
      : await client.getWithPaymentRaw(endpoint);
    if (estimate > 0) gated.paid.commit(estimate);
    else gated.paid.release();
    const structured = asStructuredContent(result);
    return ok(structured, opts.json, JSON.stringify(structured, null, 2));
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json);
  } finally {
    gated.paid.release();
  }
}
