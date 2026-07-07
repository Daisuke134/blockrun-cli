// REQ-144–147, REQ-144a, REQ-022. Pure buildRequest for `blockrun music`.
import { z } from "zod";
import { resolvePositionalAlias, type BuildResult } from "./shared.js";

export const MUSIC_COST = 0.1575;
const MUSIC_MODELS = ["minimax/music-2.5+", "minimax/music-2.5"] as const;

export const schema = z.object({
  prompt: z.string(),
  instrumental: z.boolean().optional().default(true),
  lyrics: z.string().optional(),
  model: z.enum(MUSIC_MODELS).optional().default("minimax/music-2.5+"),
  agent_id: z.string().optional(),
});

export interface MusicRequest {
  prompt: string;
  instrumental: boolean;
  lyrics?: string;
  model: string;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<MusicRequest> {
  const promptResult = resolvePositionalAlias(flags, flags.prompt, "prompt");
  if (!promptResult.ok) return promptResult;
  const prompt = promptResult.value;
  if (typeof prompt !== "string" || prompt.length === 0) {
    return { ok: false, error: "prompt is required (positional argument or --prompt)" };
  }

  const instrumental = typeof flags.instrumental === "boolean" ? flags.instrumental : true;
  const model = (flags.model as string) || "minimax/music-2.5+";
  if (!(MUSIC_MODELS as readonly string[]).includes(model)) {
    return { ok: false, error: `--model must be one of: ${MUSIC_MODELS.join(", ")}` };
  }
  const lyrics = typeof flags.lyrics === "string" ? flags.lyrics : undefined;

  if (instrumental && lyrics?.trim()) {
    return { ok: false, error: "Cannot specify --lyrics when --instrumental is true" };
  }

  const value: MusicRequest = { prompt, instrumental, model };
  if (lyrics !== undefined) value.lyrics = lyrics;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
