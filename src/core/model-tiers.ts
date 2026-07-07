// Verbatim port of blockrun-mcp's src/utils/constants.ts MODEL_TIERS table (the
// per-mode model fallback lists blockrun_chat walks when no explicit --model is
// given). Pure data — no I/O.
export const MODEL_TIERS = {
  fast: ["google/gemini-3.5-flash", "google/gemini-2.5-flash", "google/gemini-3.1-flash-lite", "openai/gpt-5-mini", "deepseek/deepseek-chat", "google/gemini-3-flash-preview"],
  balanced: ["openai/gpt-5.5", "anthropic/claude-sonnet-4.6", "google/gemini-3.1-pro", "moonshot/kimi-k2.6", "openai/gpt-5.3", "openai/gpt-5.4"],
  powerful: ["anthropic/claude-opus-4.8", "openai/gpt-5.4-pro", "anthropic/claude-opus-4.7", "anthropic/claude-opus-4.6", "openai/o3", "openai/gpt-5.4"],
  cheap: ["zai/glm-5", "zai/glm-5-turbo", "nvidia/gpt-oss-120b", "nvidia/deepseek-v4-flash", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "openai/gpt-5.4-nano"],
  reasoning: ["anthropic/claude-opus-4.8", "openai/o3", "openai/o1", "openai/o3-mini", "deepseek/deepseek-reasoner", "moonshot/kimi-k2.6", "openai/gpt-5.3-codex"],
  free: ["nvidia/llama-4-maverick", "nvidia/qwen3-coder-480b", "nvidia/deepseek-v4-flash", "nvidia/gpt-oss-120b", "nvidia/gpt-oss-20b"],
  coding: ["anthropic/claude-opus-4.8", "zai/glm-5", "openai/gpt-5.3-codex", "moonshot/kimi-k2.6", "nvidia/qwen3-coder-480b", "anthropic/claude-sonnet-4.6", "openai/gpt-5.4"],
  glm: ["zai/glm-5", "zai/glm-5-turbo"],
} as const;

export type RoutingMode = keyof typeof MODEL_TIERS;
