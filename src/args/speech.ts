// REQ-148–151, REQ-148a, REQ-022. Pure buildRequest for `blockrun speech`.
import { z } from "zod";
import { SPEECH_MODELS } from "../core/cost/speech.js";
import { resolvePositionalAlias, type BuildResult } from "./shared.js";

const SPEECH_MODEL_IDS = Object.keys(SPEECH_MODELS) as Array<keyof typeof SPEECH_MODELS>;

export const schema = z.object({
  action: z.enum(["speak", "sound_effect", "voices"]).optional().default("speak"),
  input: z.string().optional(),
  voice: z.string().optional(),
  model: z.enum(SPEECH_MODEL_IDS as [string, ...string[]]).optional().default("elevenlabs/flash-v2.5"),
  response_format: z.enum(["mp3", "opus", "pcm", "wav"]).optional().default("mp3"),
  speed: z.number().min(0.7).max(1.2).optional(),
  duration_seconds: z.number().min(0.5).max(22).optional(),
  prompt_influence: z.number().min(0).max(1).optional(),
  agent_id: z.string().optional(),
});

export interface SpeechRequest {
  action: "speak" | "sound_effect" | "voices";
  input?: string;
  voice?: string;
  model: string;
  responseFormat: string;
  speed?: number;
  durationSeconds?: number;
  promptInfluence?: number;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<SpeechRequest> {
  const action = (flags.action ?? "speak") as string;
  if (!["speak", "sound_effect", "voices"].includes(action)) {
    return { ok: false, error: "--action must be one of: speak, sound_effect, voices" };
  }

  const inputResult = resolvePositionalAlias(flags, flags.input, "input");
  if (!inputResult.ok) return inputResult;
  const input = inputResult.value;

  if (action !== "voices" && (typeof input !== "string" || input.length === 0)) {
    return { ok: false, error: `--input is required for --action ${action}` };
  }

  const model = (flags.model as string) || "elevenlabs/flash-v2.5";
  if (!SPEECH_MODEL_IDS.includes(model as keyof typeof SPEECH_MODELS)) {
    return { ok: false, error: `--model must be one of: ${SPEECH_MODEL_IDS.join(", ")}` };
  }
  const responseFormat = (flags.responseFormat as string) || "mp3";
  if (!["mp3", "opus", "pcm", "wav"].includes(responseFormat)) {
    return { ok: false, error: "--response-format must be one of: mp3, opus, pcm, wav" };
  }

  if (typeof input === "string") {
    if (action === "sound_effect" && input.length > 1000) {
      return { ok: false, error: `Sound effect description too long: ${input.length} characters (max 1000).` };
    }
    if (action === "speak") {
      const maxChars = SPEECH_MODELS[model as keyof typeof SPEECH_MODELS]?.maxInputChars ?? SPEECH_MODELS["elevenlabs/flash-v2.5"].maxInputChars;
      if (input.length > maxChars) {
        return { ok: false, error: `Input too long: ${input.length} characters (max ${maxChars} for ${model}).` };
      }
    }
  }

  if (flags.speed !== undefined) {
    const s = flags.speed;
    if (typeof s !== "number" || s < 0.7 || s > 1.2) return { ok: false, error: "--speed must be between 0.7 and 1.2" };
  }
  if (flags.durationSeconds !== undefined) {
    const d = flags.durationSeconds;
    if (typeof d !== "number" || d < 0.5 || d > 22) return { ok: false, error: "--duration-seconds must be between 0.5 and 22" };
  }
  if (flags.promptInfluence !== undefined) {
    const p = flags.promptInfluence;
    if (typeof p !== "number" || p < 0 || p > 1) return { ok: false, error: "--prompt-influence must be between 0 and 1" };
  }

  const value: SpeechRequest = { action: action as SpeechRequest["action"], model, responseFormat };
  if (typeof input === "string") value.input = input;
  if (typeof flags.voice === "string") value.voice = flags.voice;
  if (typeof flags.speed === "number") value.speed = flags.speed;
  if (typeof flags.durationSeconds === "number") value.durationSeconds = flags.durationSeconds;
  if (typeof flags.promptInfluence === "number") value.promptInfluence = flags.promptInfluence;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}
