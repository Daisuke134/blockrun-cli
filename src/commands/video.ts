// REQ-130–136, REQ-135a. `blockrun video`.
import { buildRequest, estimateVideoCost } from "../args/video.js";
import { payAndPoll } from "../shell/manual-x402.js";
import { getChain } from "../shell/wallet.js";
import { extractErrorMessage, isPaymentRejectionError } from "../core/errors.js";
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
  const { prompt, model, imageUrl, realFaceAssetId, durationSeconds, generateAudio, resolution, aspectRatio, lastFrameUrl, agent_id, maxQuoteUsd } = built.value;

  if (getChain() !== "base") {
    return fail(
      "blockrun video currently settles on Base only. Switch BlockRun to Base (blockrun wallet --action chain --chain base) and fund the Base wallet with USDC.",
      opts.json,
      { chain: "solana" },
    );
  }

  const hasImageInput = Boolean(imageUrl || realFaceAssetId);
  const estimate = estimateVideoCost(model, durationSeconds, hasImageInput);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  const body: Record<string, unknown> = { model, prompt };
  if (imageUrl) body.image_url = imageUrl;
  if (realFaceAssetId) body.real_face_asset_id = realFaceAssetId;
  if (durationSeconds !== undefined) body.duration_seconds = durationSeconds;
  if (generateAudio !== undefined) body.generate_audio = generateAudio;
  if (resolution !== undefined) body.resolution = resolution;
  if (aspectRatio !== undefined) body.aspect_ratio = aspectRatio;
  if (lastFrameUrl) body.last_frame_url = lastFrameUrl;

  try {
    const result = await payAndPoll({
      endpoint: "/v1/videos/generations",
      body,
      resourceDescription: "BlockRun Video Generation",
      pollIntervalMs: 5_000,
      totalBudgetMs: 300_000,
      onQuote: (quotedUsd) => {
        // REQ-135a: the user's explicit per-call ceiling, checked first (it's a
        // deterministic cap the caller chose; the budget re-check below is the
        // general REQ-220 rail and doesn't know about this flag).
        if (maxQuoteUsd !== undefined && quotedUsd !== null && quotedUsd > maxQuoteUsd) {
          throw new Error(`Quote $${quotedUsd.toFixed(4)} exceeds --max-quote-usd $${maxQuoteUsd.toFixed(2)} — aborting before signing.`);
        }
        // REQ-220: re-validate the REAL quoted amount against both the
        // ephemeral per-invocation cap and the persisted ledger cap BEFORE any
        // signature is produced — a token-priced Seedance/Sora render can
        // settle for far more than the per-second estimate.
        const check = gated.paid.reverify(quotedUsd);
        if (!check.allowed) {
          throw new Error(check.reason ?? "Budget cap would be exceeded by the real quoted price.");
        }
      },
    });

    const billedUsd = result.billedUsd ?? estimate;
    gated.paid.commit(result.billedUsd);
    const clip = result.data as { url: string; duration_seconds?: number };
    return ok(
      { url: clip.url, duration_seconds: clip.duration_seconds, model, cost_usd: billedUsd, ...(result.txHash ? { txHash: result.txHash } : {}) },
      opts.json,
      `Video ready!\nURL: ${clip.url}\nModel: ${model}\nCost: $${billedUsd.toFixed(4)}`,
    );
  } catch (err) {
    const msg = extractErrorMessage(err);
    if (isPaymentRejectionError(msg)) return fail(msg, opts.json, { chain: getChain() });
    return fail(msg, opts.json, { altModels: "bytedance/seedance-2.0, azure/sora-2", chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
