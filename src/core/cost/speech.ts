// Verbatim port of blockrun-mcp's src/tools/speech.ts:33-58 (verification-architecture.md §1.1).
export const MARGIN = 1.05;
const MIN_PAYMENT_USD = 0.001;
export const SOUND_EFFECT_COST = 0.05 * MARGIN;

export const SPEECH_MODELS: Record<string, { pricePer1kChars: number; maxInputChars: number }> = {
  "elevenlabs/flash-v2.5": { pricePer1kChars: 0.05, maxInputChars: 40_000 },
  "elevenlabs/turbo-v2.5": { pricePer1kChars: 0.05, maxInputChars: 40_000 },
  "elevenlabs/multilingual-v2": { pricePer1kChars: 0.1, maxInputChars: 10_000 },
  "elevenlabs/v3": { pricePer1kChars: 0.1, maxInputChars: 5_000 },
};

export function speechCost(model: string, charCount: number): number {
  const m = SPEECH_MODELS[model];
  const raw = (charCount / 1000) * (m?.pricePer1kChars ?? 0.05) * MARGIN;
  return Math.max(raw, MIN_PAYMENT_USD);
}
