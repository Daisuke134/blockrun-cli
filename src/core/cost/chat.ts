// Verbatim port of blockrun-mcp's src/tools/chat.ts:22-79 and
// src/tools/chat-anthropic.ts:22-43 (verification-architecture.md §1.1).
export function estimateChatCost(
  maxTokens: number | undefined,
  mode: string | undefined,
  model: string | undefined,
  routing: string | undefined,
  routingProfile: string | undefined,
  thinkingBudget?: number,
): number {
  if (mode === "free") return 0;
  if (model?.startsWith("nvidia/")) return 0;

  const out = Math.max((maxTokens ?? 1024) + (thinkingBudget ?? 0), 256);
  const frontierReserve = Math.max(0.01, (out / 1_000_000) * 20);

  if (routing === "smart") {
    switch (routingProfile) {
      case "eco":     return 0.01;
      case "premium": return frontierReserve;
      case "auto":
      default:        return Math.max(0.01, frontierReserve * 0.5);
    }
  }

  const effectiveMode = mode ?? "balanced";
  if (
    effectiveMode === "reasoning" ||
    effectiveMode === "powerful" ||
    effectiveMode === "balanced" ||
    effectiveMode === "coding"
  ) {
    return frontierReserve;
  }
  if (model) return frontierReserve;

  return Math.max(0.002, (out / 1_000_000) * 3);
}

/**
 * Reconstruct the real cost of a native Anthropic call from its token usage.
 * AnthropicClient settles the 402 internally and never exposes the amount, so
 * token-count × the model's published per-1M rate is the best signal available
 * — ported verbatim from chat-anthropic.ts's anthropicCallCost. Returns null
 * when usage is absent so the caller falls back to the pre-call estimate.
 */
export function anthropicCallCost(
  model: string,
  usage?: { input_tokens?: number; output_tokens?: number } | null,
): number | null {
  if (!usage) return null;
  const id = model.toLowerCase();
  let inRate = 5, outRate = 25; // safe default (≈ Sonnet, slightly high)
  if (id.includes("opus")) { inRate = 15; outRate = 75; }
  else if (id.includes("haiku")) { inRate = 1; outRate = 5; }
  else if (id.includes("sonnet")) { inRate = 3; outRate = 15; }
  const cost =
    ((usage.input_tokens ?? 0) / 1_000_000) * inRate +
    ((usage.output_tokens ?? 0) / 1_000_000) * outRate;
  return cost > 0 ? cost : null;
}
