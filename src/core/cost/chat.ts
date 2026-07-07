// Verbatim port of blockrun-mcp's src/tools/chat.ts:22-79 (verification-architecture.md §1.1).
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
