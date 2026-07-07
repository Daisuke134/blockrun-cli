// REQ-120–122. Pure buildRequest + filterModels for `blockrun models`.
import { z } from "zod";
import type { BuildResult } from "./shared.js";

export const schema = z.object({
  category: z.enum(["all", "chat", "reasoning", "image", "embedding"]).optional().default("all"),
  provider: z.string().optional(),
});

export interface ModelsRequest {
  category: "all" | "chat" | "reasoning" | "image" | "embedding";
  provider?: string;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<ModelsRequest> {
  const category = (flags.category ?? "all") as string;
  if (!["all", "chat", "reasoning", "image", "embedding"].includes(category)) {
    return { ok: false, error: "--category must be one of: all, chat, reasoning, image, embedding" };
  }
  const value: ModelsRequest = { category: category as ModelsRequest["category"] };
  if (typeof flags.provider === "string") value.provider = flags.provider;
  return { ok: true, value };
}

interface ModelEntry {
  id: string;
  categories?: string[];
  type?: string;
  pricePerImage?: number;
  [key: string]: unknown;
}

function getModelType(model: ModelEntry): "llm" | "image" {
  return model.type === "image" || "pricePerImage" in model ? "image" : "llm";
}

export function filterModels<T extends ModelEntry>(models: T[], category: string, provider: string | undefined): T[] {
  let out = models;
  if (provider) {
    const p = provider.toLowerCase();
    out = out.filter((m) => m.id.toLowerCase().startsWith(p + "/"));
  }
  if (category && category !== "all") {
    if (category === "image") {
      out = out.filter((m) => getModelType(m) === "image");
    } else if (category === "embedding") {
      out = out.filter((m) => m.id.includes("embed"));
    } else {
      out = out.filter((m) => "categories" in m && m.categories?.includes(category));
    }
  }
  return out;
}
