// Verbatim port of blockrun-mcp's src/tools/image.ts:94-155 (verification-architecture.md §1.1).
const GENERATE_MODEL_COST: Record<string, number> = {
  "zai/cogview-4": 0.015,
  "xai/grok-imagine-image": 0.02,
  "xai/grok-imagine-image-pro": 0.07,
  "openai/gpt-image-1": 0.02,
  "openai/gpt-image-2": 0.06,
  "google/nano-banana": 0.05,
  "google/nano-banana-pro": 0.10,
};

const LARGE_SIZE_COST: Record<string, number> = {
  "openai/gpt-image-1": 0.04,
  "openai/gpt-image-2": 0.12,
  "google/nano-banana-pro": 0.15,
};

export function isLargerThanBase(size: string): boolean {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(size);
  if (!m) return false;
  return Math.max(Number(m[1]), Number(m[2])) > 1024;
}

export function estimateCost(model: string, size: string): number {
  const base = GENERATE_MODEL_COST[model] ?? 0.06;
  if (LARGE_SIZE_COST[model] && isLargerThanBase(size)) {
    return LARGE_SIZE_COST[model];
  }
  return base;
}

export const EDIT_MODELS = new Set([
  "openai/gpt-image-1",
  "openai/gpt-image-2",
  "google/nano-banana",
  "google/nano-banana-pro",
]);

export const MAX_EDIT_IMAGES_BY_PREFIX: Record<string, number> = {
  "openai/": 4,
  "google/": 3,
};

export const MASK_MODELS = new Set(["openai/gpt-image-1", "openai/gpt-image-2"]);

export const IMAGE_MODELS = [
  "zai/cogview-4",
  "google/nano-banana",
  "google/nano-banana-pro",
  "openai/gpt-image-1",
  "openai/gpt-image-2",
  "xai/grok-imagine-image",
  "xai/grok-imagine-image-pro",
] as const;
