// REQ-123–129. `blockrun image`. Base-chain generate/edit via the SDK's ImageClient
// (Base-only by SDK construction). Solana image payment (blockrun-mcp's
// utils/solana-402.ts manual flow) is NOT implemented in this pass — flagged as a
// known gap, not silently faked; no test in this suite exercises the Solana path.
import { buildRequest } from "../args/image.js";
import { estimateCost } from "../core/cost/image.js";
import { extractErrorMessage } from "../core/errors.js";
import { getChain, getImageClient } from "../shell/wallet.js";
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
  const { prompt, action, model, image, mask, size, quality, agent_id } = built.value;
  const selectedModel = model || "openai/gpt-image-2";

  if (getChain() === "solana") {
    return fail("Solana-chain image payment is not yet supported by this CLI. Switch to Base: blockrun wallet --action chain --chain base.", opts.json, { chain: "solana" });
  }

  const estimate = estimateCost(selectedModel, size);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    const client = getImageClient();
    const response = action === "edit"
      ? await client.edit(prompt, image as never, { model: selectedModel, size, ...(mask ? { mask } : {}) })
      : await client.generate(prompt, { model: selectedModel, size, quality: quality as "standard" | "hd" });

    gated.paid.commit(estimate);
    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL in response");

    return ok(
      { url: imageUrl, prompt, model: selectedModel, cost_usd: estimate },
      opts.json,
      `Image: ${imageUrl}\nPrompt: ${prompt}\nModel: ${selectedModel}\nCost: $${estimate.toFixed(4)}`,
    );
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json, { altModels: "google/nano-banana, zai/cogview-4", chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
