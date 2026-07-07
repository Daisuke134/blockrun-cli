// REQ-144–147. `blockrun music`.
import { buildRequest, MUSIC_COST } from "../args/music.js";
import { payAndPoll } from "../shell/manual-x402.js";
import { getChain } from "../shell/wallet.js";
import { extractErrorMessage } from "../core/errors.js";
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
  const { prompt, instrumental, lyrics, model, agent_id } = built.value;

  if (getChain() !== "base") {
    return fail(
      "blockrun music currently settles on Base only. Switch BlockRun to Base (blockrun wallet --action chain --chain base) and fund the Base wallet with USDC.",
      opts.json,
      { chain: "solana" },
    );
  }

  const gated = gatePaidCall(budget, agent_id, MUSIC_COST, opts.json);
  if (!gated.ok) return gated.outcome;

  const body: Record<string, unknown> = { model, prompt, instrumental };
  if (lyrics?.trim()) body.lyrics = lyrics.trim();

  try {
    const result = await payAndPoll({
      endpoint: "/v1/audio/generations",
      body,
      resourceDescription: "BlockRun Music Generation",
      pollIntervalMs: 5_000,
      totalBudgetMs: 240_000,
    });

    const billedUsd = result.billedUsd ?? MUSIC_COST;
    gated.paid.commit(result.billedUsd);
    const track = result.data as { url: string; duration_seconds?: number; lyrics?: string };
    return ok(
      { url: track.url, duration_seconds: track.duration_seconds, model, cost_usd: billedUsd, ...(track.lyrics ? { lyrics: track.lyrics } : {}), ...(result.txHash ? { txHash: result.txHash } : {}) },
      opts.json,
      `Track ready!\nURL: ${track.url}\nModel: ${model}\nCost: $${billedUsd.toFixed(4)}`,
    );
  } catch (err) {
    const msg = extractErrorMessage(err);
    return fail(msg, opts.json, { chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
