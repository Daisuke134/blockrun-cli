// REQ-123–129, REQ-123a, REQ-022. Pure buildRequest for `blockrun image`.
import { z } from "zod";
import { EDIT_MODELS, IMAGE_MODELS, MASK_MODELS, MAX_EDIT_IMAGES_BY_PREFIX } from "../core/cost/image.js";
import { resolvePositionalAlias, type BuildResult } from "./shared.js";

export const schema = z.object({
  prompt: z.string(),
  action: z.enum(["generate", "edit"]).optional().default("generate"),
  model: z.enum(IMAGE_MODELS).optional(),
  image: z.union([z.string(), z.array(z.string()).min(1).max(4)]).optional(),
  mask: z.string().optional(),
  size: z.string().optional().default("1024x1024"),
  quality: z.enum(["standard", "hd"]).optional().default("standard"),
  inline: z.boolean().optional(),
  agent_id: z.string().optional(),
});

export interface ImageRequest {
  prompt: string;
  action: "generate" | "edit";
  model?: string;
  image?: string | string[];
  mask?: string;
  size: string;
  quality: "standard" | "hd";
  inline?: boolean;
  agent_id?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<ImageRequest> {
  const promptResult = resolvePositionalAlias(flags, flags.prompt, "prompt");
  if (!promptResult.ok) return promptResult;
  const prompt = promptResult.value;
  if (typeof prompt !== "string" || prompt.length === 0) {
    return { ok: false, error: "prompt is required (positional argument or --prompt)" };
  }

  const action = (flags.action ?? "generate") as string;
  if (!["generate", "edit"].includes(action)) {
    return { ok: false, error: "--action must be 'generate' or 'edit'" };
  }
  if (flags.model !== undefined && !(IMAGE_MODELS as readonly string[]).includes(flags.model as string)) {
    return { ok: false, error: `--model must be one of: ${IMAGE_MODELS.join(", ")}` };
  }
  const selectedModel = (flags.model as string) || "openai/gpt-image-2";

  const size = typeof flags.size === "string" ? flags.size : "1024x1024";
  const quality = (flags.quality as string) ?? "standard";
  if (!["standard", "hd"].includes(quality)) {
    return { ok: false, error: "--quality must be 'standard' or 'hd'" };
  }

  const image = flags.image as string | string[] | undefined;
  const mask = typeof flags.mask === "string" ? flags.mask : undefined;

  if (action === "edit") {
    if (image === undefined) {
      return { ok: false, error: "--image is required for --action edit (base64, URL, or local path)" };
    }
    if (!EDIT_MODELS.has(selectedModel)) {
      return { ok: false, error: "Image edits support openai/gpt-image-1, openai/gpt-image-2, google/nano-banana, or google/nano-banana-pro" };
    }
    const sourceImages = Array.isArray(image) ? image : [image];
    const maxImages = MAX_EDIT_IMAGES_BY_PREFIX[`${selectedModel.split("/")[0]}/`] ?? 1;
    if (sourceImages.length > maxImages) {
      return { ok: false, error: `${selectedModel} accepts at most ${maxImages} source image${maxImages > 1 ? "s" : ""} per edit (got ${sourceImages.length}).` };
    }
    if (mask !== undefined) {
      if (!MASK_MODELS.has(selectedModel)) {
        return { ok: false, error: "mask (inpaint) is supported only by openai/gpt-image-1 and openai/gpt-image-2" };
      }
      if (sourceImages.length > 1) {
        return { ok: false, error: "mask cannot be combined with multiple source images; send a single image with a mask, or multiple images without a mask" };
      }
    }
  }

  const value: ImageRequest = { prompt, action: action as "generate" | "edit", size, quality: quality as "standard" | "hd" };
  if (typeof flags.model === "string") value.model = flags.model;
  if (image !== undefined) value.image = image;
  if (mask !== undefined) value.mask = mask;
  if (typeof flags.inline === "boolean") value.inline = flags.inline;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  return { ok: true, value };
}

/**
 * REQ-127/REQ-220: endpoint + body for a Solana-gateway image call. Pure —
 * ported from blockrun-mcp's image.ts buildSolanaImageRequest. The Solana
 * gateway's schema takes quality as low|medium|high|auto (the OpenAI latency
 * knob), not this tool's standard|hd — map hd→high and drop standard (the
 * gateway default) so the request isn't rejected with a 400.
 */
export function buildSolanaImageRequest(
  action: "generate" | "edit",
  params: { model: string; prompt: string; size: string; quality?: string; image?: string | string[]; mask?: string },
): { endpoint: string; body: Record<string, unknown> } {
  if (action === "edit") {
    return {
      endpoint: "/v1/images/image2image",
      body: {
        model: params.model,
        prompt: params.prompt,
        image: params.image,
        size: params.size,
        n: 1,
        ...(params.mask ? { mask: params.mask } : {}),
      },
    };
  }
  return {
    endpoint: "/v1/images/generations",
    body: {
      model: params.model,
      prompt: params.prompt,
      size: params.size,
      n: 1,
      ...(params.quality === "hd" ? { quality: "high" } : {}),
    },
  };
}
