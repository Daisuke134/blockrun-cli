// Impure shell: model catalog cache, ported from blockrun-mcp's src/utils/model-cache.ts.
export type ModelEntry = Record<string, unknown> & { id: string };
export type ModelCache = { models: ModelEntry[] | null };

type ModelLister = {
  listModels: () => Promise<ModelEntry[]>;
  listAllModels?: () => Promise<ModelEntry[]>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadModels(llm: ModelLister, cache: ModelCache): Promise<ModelEntry[]> {
  if (cache.models === null || cache.models.length === 0) {
    cache.models = llm.listAllModels
      ? await llm.listAllModels()
      : await llm.listModels();
    setTimeout(() => { cache.models = null; }, CACHE_TTL_MS).unref();
  }
  return cache.models;
}
