// REQ-130–136, REQ-130a, REQ-135a, REQ-022. Pure buildRequest + estimateVideoCost for
// `blockrun video`. No dedicated cost/video.ts module (verification-architecture.md §1.1
// only lists the 10 named cost/*.ts ports) — the per-second cost table + validations
// live directly here (decisions.md).
import { z } from "zod";
import { resolvePositionalAlias, type BuildResult } from "./shared.js";

const VIDEO_MODELS = [
  "azure/sora-2",
  "xai/grok-imagine-video",
  "bytedance/seedance-1.5-pro",
  "bytedance/seedance-2.0-fast",
  "bytedance/seedance-2.0",
] as const;

const REALFACE_MODELS = new Set(["bytedance/seedance-2.0", "bytedance/seedance-2.0-fast"]);

const VIDEO_PRICE_PER_SECOND: Record<string, number> = {
  "xai/grok-imagine-video": 0.05,
  "bytedance/seedance-1.5-pro": 0.092,
  "bytedance/seedance-2.0-fast": 0.238,
  "bytedance/seedance-2.0": 0.298,
  "azure/sora-2": 0.10,
};

const VIDEO_PRICE_PER_SECOND_IMAGE: Record<string, number> = {
  "bytedance/seedance-2.0-fast": 0.140,
  "bytedance/seedance-2.0": 0.183,
};

const VIDEO_DEFAULT_DURATION: Record<string, number> = {
  "xai/grok-imagine-video": 8,
  "bytedance/seedance-1.5-pro": 5,
  "bytedance/seedance-2.0-fast": 5,
  "bytedance/seedance-2.0": 5,
  "azure/sora-2": 4,
};

export function estimateVideoCost(model: string, durationSeconds: number | undefined, hasImageInput: boolean): number {
  const billedSeconds = durationSeconds ?? VIDEO_DEFAULT_DURATION[model] ?? 8;
  const perSecond = (hasImageInput ? VIDEO_PRICE_PER_SECOND_IMAGE[model] : undefined) ?? VIDEO_PRICE_PER_SECOND[model] ?? 0.05;
  return perSecond * billedSeconds;
}

export const schema = z.object({
  prompt: z.string(),
  image_url: z.string().url().optional(),
  real_face_asset_id: z.string().regex(/^ta_[A-Za-z0-9]+$/).optional(),
  duration_seconds: z.number().int().min(1).max(60).optional(),
  generate_audio: z.boolean().optional(),
  resolution: z.enum(["360p", "480p", "540p", "720p", "1080p", "1K", "2K", "4K"]).optional(),
  aspect_ratio: z.enum(["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"]).optional(),
  last_frame_url: z.string().url().optional(),
  model: z.enum(VIDEO_MODELS).optional().default("xai/grok-imagine-video"),
  agent_id: z.string().optional(),
});

export interface VideoRequest {
  prompt: string;
  model: string;
  imageUrl?: string;
  realFaceAssetId?: string;
  durationSeconds?: number;
  generateAudio?: boolean;
  resolution?: string;
  aspectRatio?: string;
  lastFrameUrl?: string;
  agent_id?: string;
  maxQuoteUsd?: number;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<VideoRequest> {
  const promptResult = resolvePositionalAlias(flags, flags.prompt, "prompt");
  if (!promptResult.ok) return promptResult;
  const prompt = promptResult.value;
  if (typeof prompt !== "string" || prompt.length === 0) {
    return { ok: false, error: "prompt is required (positional argument or --prompt)" };
  }

  const model = (flags.model as string) || "xai/grok-imagine-video";
  if (!(VIDEO_MODELS as readonly string[]).includes(model)) {
    return { ok: false, error: `--model must be one of: ${VIDEO_MODELS.join(", ")}` };
  }

  const durationSeconds = flags.durationSeconds as number | undefined;
  if (durationSeconds !== undefined) {
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 60) {
      return { ok: false, error: "--duration-seconds must be an integer between 1 and 60" };
    }
    if (model === "azure/sora-2" && ![4, 8, 12].includes(durationSeconds)) {
      return { ok: false, error: "azure/sora-2 requires --duration-seconds to be 4, 8, or 12" };
    }
  }

  const realFaceAssetId = flags.realFaceAssetId as string | undefined;
  const imageUrl = flags.imageUrl as string | undefined;
  const lastFrameUrl = flags.lastFrameUrl as string | undefined;

  if (realFaceAssetId !== undefined) {
    if (!/^ta_[A-Za-z0-9]+$/.test(realFaceAssetId)) {
      return { ok: false, error: "--real-face-asset-id must look like 'ta_xxxx'" };
    }
    if (imageUrl !== undefined) {
      return { ok: false, error: "--real-face-asset-id and --image-url are mutually exclusive" };
    }
    if (!REALFACE_MODELS.has(model)) {
      return { ok: false, error: "--real-face-asset-id requires a Seedance 2.0-family model (bytedance/seedance-2.0 or bytedance/seedance-2.0-fast)" };
    }
  }

  if (lastFrameUrl !== undefined) {
    if (imageUrl === undefined) {
      return { ok: false, error: "--last-frame-url requires --image-url as the first frame" };
    }
    if (realFaceAssetId !== undefined) {
      return { ok: false, error: "--last-frame-url cannot be combined with --real-face-asset-id" };
    }
  }

  let maxQuoteUsd: number | undefined;
  if (flags.maxQuoteUsd !== undefined) {
    const n = flags.maxQuoteUsd;
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "--max-quote-usd must be a positive finite number" };
    }
    maxQuoteUsd = n;
  }

  const value: VideoRequest = { prompt, model };
  if (imageUrl !== undefined) value.imageUrl = imageUrl;
  if (realFaceAssetId !== undefined) value.realFaceAssetId = realFaceAssetId;
  if (durationSeconds !== undefined) value.durationSeconds = durationSeconds;
  if (typeof flags.generateAudio === "boolean") value.generateAudio = flags.generateAudio;
  if (typeof flags.resolution === "string") value.resolution = flags.resolution;
  if (typeof flags.aspectRatio === "string") value.aspectRatio = flags.aspectRatio;
  if (lastFrameUrl !== undefined) value.lastFrameUrl = lastFrameUrl;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  if (maxQuoteUsd !== undefined) value.maxQuoteUsd = maxQuoteUsd;
  return { ok: true, value };
}
