// REQ-120–122. `blockrun models` — free.
import { buildRequest, filterModels } from "../args/models.js";
import { extractErrorMessage } from "../core/errors.js";
import { getClient } from "../shell/wallet.js";
import { loadModels, type ModelCache, type ModelEntry } from "../shell/model-cache.js";
import { ok, fail } from "../core/render.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

const cache: ModelCache = { models: null };

function getModelType(model: ModelEntry): "llm" | "image" {
  return model.type === "image" || "pricePerImage" in model ? "image" : "llm";
}

function formatModelLine(m: ModelEntry): string {
  if (getModelType(m) === "image") {
    const pricing = m.pricePerImage ? `$${m.pricePerImage}/image` : "";
    const sizes = Array.isArray(m.supportedSizes) && m.supportedSizes.length ? ` | sizes: ${(m.supportedSizes as string[]).join(", ")}` : "";
    return `- ${m.id}${pricing ? ` (${pricing})` : ""}${sizes} [image]`;
  }
  const input = m.inputPrice ? `$${m.inputPrice}/M in` : "";
  const output = m.outputPrice ? `$${m.outputPrice}/M out` : "";
  const pricing = [input, output].filter(Boolean).join(", ");
  const ctx = typeof m.contextWindow === "number" ? ` | ${Math.round(m.contextWindow / 1000)}K ctx` : "";
  const cats = Array.isArray(m.categories) && m.categories.length ? ` [${(m.categories as string[]).join(", ")}]` : "";
  return `- ${m.id}${pricing ? ` (${pricing})` : ""}${ctx}${cats}`;
}

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  _budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json);
  const { category, provider } = built.value;

  try {
    const catalog = await loadModels(getClient() as never, cache);
    const models = filterModels(catalog, category, provider);
    const lines = models.map(formatModelLine);
    return ok({ count: models.length, models }, opts.json, `Models (${models.length}):\n${lines.join("\n")}`);
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json);
  }
}
