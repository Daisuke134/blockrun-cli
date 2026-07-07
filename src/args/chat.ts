// REQ-108–119, REQ-108a, REQ-114a, REQ-022. Pure buildRequest for `blockrun chat`.
import { z } from "zod";
import { resolvePositionalAlias, type BuildResult } from "./shared.js";

const CHAT_MODES = ["fast", "balanced", "powerful", "cheap", "reasoning", "free", "coding", "glm"] as const;
const ROUTING_PROFILES = ["free", "eco", "auto", "premium"] as const;

const thinkingSchema = z.object({
  type: z.literal("enabled"),
  budget_tokens: z.number().int().min(1024).max(100_000),
});

export const schema = z.object({
  message: z.string(),
  model: z.string().optional(),
  mode: z.enum(CHAT_MODES).optional(),
  routing: z.enum(["smart"]).optional(),
  routing_profile: z.enum(ROUTING_PROFILES).optional().default("auto"),
  system: z.string().optional(),
  max_tokens: z.number().optional().default(1024),
  temperature: z.number().optional().default(1),
  response_format: z.enum(["text", "json_object"]).optional(),
  stop: z.array(z.string()).max(4).optional(),
  thinking: thinkingSchema.optional(),
  agent_id: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.union([
      z.string(),
      z.array(z.union([
        z.object({ type: z.literal("text"), text: z.string() }),
        z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string() }) }),
      ])),
    ]),
  })).optional(),
});

export interface ChatThinking {
  type: "enabled";
  budget_tokens: number;
}

export interface ChatRequest {
  message: string;
  model?: string;
  mode?: string;
  routing?: "smart";
  routingProfile: string;
  system?: string;
  maxTokens: number;
  temperature: number;
  responseFormat?: "text" | "json_object";
  stop?: string[];
  thinking?: ChatThinking;
  agent_id?: string;
  messages?: Array<{ role: string; content: unknown }>;
}

export function buildRequest(flags: Record<string, unknown>): BuildResult<ChatRequest> {
  const msgResult = resolvePositionalAlias(flags, flags.message, "message");
  if (!msgResult.ok) return msgResult;
  const message = msgResult.value;
  if (typeof message !== "string" || message.length === 0) {
    return { ok: false, error: "message is required (positional argument or --message)" };
  }

  if (flags.mode !== undefined && !(CHAT_MODES as readonly string[]).includes(flags.mode as string)) {
    return { ok: false, error: `--mode must be one of: ${CHAT_MODES.join(", ")}` };
  }
  if (flags.routingProfile !== undefined && !(ROUTING_PROFILES as readonly string[]).includes(flags.routingProfile as string)) {
    return { ok: false, error: `--routing-profile must be one of: ${ROUTING_PROFILES.join(", ")}` };
  }

  let stop: string[] | undefined;
  if (flags.stop !== undefined) {
    stop = Array.isArray(flags.stop) ? (flags.stop as string[]) : [flags.stop as string];
    if (stop.length > 4) return { ok: false, error: "--stop accepts at most 4 sequences" };
  }

  let thinking = flags.thinking as ChatThinking | undefined;
  if (flags.thinkingBudgetTokens !== undefined) {
    if (thinking !== undefined) {
      return { ok: false, error: "--thinking conflicts with --thinking-budget-tokens — supply only one" };
    }
    const n = flags.thinkingBudgetTokens;
    if (typeof n !== "number" || n < 1024 || n > 100_000) {
      return { ok: false, error: "--thinking-budget-tokens must be between 1024 and 100000" };
    }
    thinking = { type: "enabled", budget_tokens: n };
  }
  if (thinking !== undefined) {
    if (thinking.type !== "enabled" || typeof thinking.budget_tokens !== "number" || thinking.budget_tokens < 1024 || thinking.budget_tokens > 100_000) {
      return { ok: false, error: "--thinking budget_tokens must be between 1024 and 100000" };
    }
  }

  const messages = Array.isArray(flags.messages) ? (flags.messages as Array<{ role: string; content: unknown }>) : undefined;
  if (flags.routing === "smart" && messages && messages.length > 0) {
    return { ok: false, error: 'routing:"smart" does not support multi-turn --messages — send a single --message with routing:"smart", or use --messages with an explicit --model/--mode.' };
  }

  const value: ChatRequest = {
    message,
    maxTokens: typeof flags.maxTokens === "number" ? flags.maxTokens : 1024,
    temperature: typeof flags.temperature === "number" ? flags.temperature : 1,
    routingProfile: typeof flags.routingProfile === "string" ? flags.routingProfile : "auto",
  };
  if (typeof flags.model === "string") value.model = flags.model;
  if (typeof flags.mode === "string") value.mode = flags.mode;
  if (flags.routing === "smart") value.routing = "smart";
  if (typeof flags.system === "string") value.system = flags.system;
  if (flags.responseFormat === "text" || flags.responseFormat === "json_object") value.responseFormat = flags.responseFormat;
  if (stop !== undefined) value.stop = stop;
  if (thinking !== undefined) value.thinking = thinking;
  if (typeof flags.agentId === "string") value.agent_id = flags.agentId;
  if (messages !== undefined) value.messages = messages;

  return { ok: true, value };
}
