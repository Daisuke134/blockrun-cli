// REQ-148–151. `blockrun speech`.
import { buildRequest } from "../args/speech.js";
import { speechCost, SOUND_EFFECT_COST } from "../core/cost/speech.js";
import { payOnce } from "../shell/manual-x402.js";
import { fetchJson } from "../shell/http.js";
import { getChain } from "../shell/wallet.js";
import { extractErrorMessage } from "../core/errors.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

const VOICE_ALIASES: Array<{ alias: string; description: string }> = [
  { alias: "sarah", description: "Mature, reassuring, confident (default)" },
  { alias: "george", description: "Warm, captivating storyteller" },
  { alias: "laura", description: "Enthusiast, quirky" },
  { alias: "charlie", description: "Deep, confident, energetic" },
  { alias: "river", description: "Relaxed, neutral, informative" },
  { alias: "roger", description: "Laid-back, casual, resonant" },
  { alias: "callum", description: "Husky trickster" },
  { alias: "harry", description: "Fierce warrior" },
];

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json);
  const { action, input, voice, model, responseFormat, speed, durationSeconds, promptInfluence, agent_id } = built.value;

  if (action === "voices") {
    try {
      const { status, data } = await fetchJson("https://blockrun.ai/api/v1/audio/voices", { method: "GET" }, 15_000);
      const voices = status === 200 && Array.isArray(data.data) ? data.data : null;
      if (voices && voices.length > 0) {
        const lines = voices.map((v: { voice_id: string; alias?: string }) => `- ${v.alias ? `${v.alias} ` : ""}(${v.voice_id})`);
        return ok({ voices }, opts.json, `Available voices:\n${lines.join("\n")}`);
      }
    } catch { /* fall through to built-in aliases */ }
    const lines = VOICE_ALIASES.map((v) => `- ${v.alias} — ${v.description}`);
    return ok({ voices: VOICE_ALIASES }, opts.json, `Built-in voice aliases:\n${lines.join("\n")}`);
  }

  if (getChain() !== "base") {
    return fail(
      "blockrun speech currently settles on Base only. Switch BlockRun to Base (blockrun wallet --action chain --chain base) and fund the Base wallet with USDC.",
      opts.json,
      { chain: "solana" },
    );
  }

  let endpoint: string;
  let body: Record<string, unknown>;
  let cost: number;

  if (action === "sound_effect") {
    endpoint = "/v1/audio/sound-effects";
    body = { model: "elevenlabs/sound-effects", text: input, response_format: responseFormat };
    if (durationSeconds !== undefined) body.duration_seconds = durationSeconds;
    if (promptInfluence !== undefined) body.prompt_influence = promptInfluence;
    cost = SOUND_EFFECT_COST;
  } else {
    endpoint = "/v1/audio/speech";
    body = { model, input, voice: voice || "sarah", response_format: responseFormat };
    if (speed !== undefined) body.speed = speed;
    cost = speechCost(model, input?.length ?? 0);
  }

  const gated = gatePaidCall(budget, agent_id, cost, opts.json);
  if (!gated.ok) return gated.outcome;

  try {
    const result = await payOnce({
      endpoint,
      body,
      resourceDescription: "BlockRun Speech",
      // REQ-220: re-validate the real 402-quoted amount against both budget
      // caps BEFORE any signature is produced.
      onQuote: (quotedUsd) => {
        const check = gated.paid.reverify(quotedUsd);
        if (!check.allowed) {
          throw new Error(check.reason ?? "Budget cap would be exceeded by the real quoted price.");
        }
      },
    });
    const billedUsd = result.billedUsd ?? cost;
    gated.paid.commit(result.billedUsd);
    const clip = result.data as { url: string; format?: string; characters?: number; duration_seconds?: number };
    return ok(
      {
        url: clip.url,
        format: clip.format ?? responseFormat,
        ...(clip.characters !== undefined ? { characters: clip.characters } : {}),
        ...(clip.duration_seconds !== undefined ? { duration_seconds: clip.duration_seconds } : {}),
        model: action === "sound_effect" ? "elevenlabs/sound-effects" : model,
        cost_usd: billedUsd,
        ...(result.txHash ? { txHash: result.txHash } : {}),
      },
      opts.json,
      `Speech ready!\nURL: ${clip.url}\nCost: $${billedUsd.toFixed(4)}`,
    );
  } catch (err) {
    const msg = extractErrorMessage(err);
    return fail(msg, opts.json, { chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
