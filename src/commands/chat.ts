// REQ-108–119, REQ-117. `blockrun chat`.
import { buildRequest } from "../args/chat.js";
import { estimateChatCost, anthropicCallCost } from "../core/cost/chat.js";
import { MODEL_TIERS, type RoutingMode } from "../core/model-tiers.js";
import { extractErrorMessage } from "../core/errors.js";
import { buildClient, getChain } from "../shell/wallet.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

type InboundContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type InboundMessage = { role: "user" | "assistant" | "system"; content: string | InboundContentPart[] };

/** Convert an OpenAI-style content part array to native Anthropic content blocks
 *  (ported from blockrun-mcp's chat-anthropic.ts toAnthropicContent). */
function toAnthropicContent(content: string | InboundContentPart[]): string | Array<Record<string, unknown>> {
  if (typeof content === "string") return content;
  const blocks: Array<Record<string, unknown>> = [];
  for (const part of content) {
    if (part.type === "text") {
      if (part.text) blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      const url = part.image_url?.url;
      if (!url) continue;
      if (/^data:image\/([a-z0-9.+-]+)(?:;[^;,]+)*;base64,(.+)$/i.test(url)) {
        const m = /^data:image\/([a-z0-9.+-]+)(?:;[^;,]+)*;base64,(.+)$/i.exec(url)!;
        let subtype = m[1].toLowerCase();
        if (subtype === "jpg") subtype = "jpeg";
        if (!["jpeg", "png", "gif", "webp"].includes(subtype)) continue;
        blocks.push({ type: "image", source: { type: "base64", media_type: `image/${subtype}`, data: m[2] } });
      } else {
        blocks.push({ type: "image", source: { type: "url", url } });
      }
    }
  }
  return blocks;
}

interface ChatLikeClient {
  chat: (model: string, message: string, options?: Record<string, unknown>) => Promise<string>;
  chatCompletion?: (model: string, messages: unknown[], options?: Record<string, unknown>) => Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
  smartChat?: (message: string, options?: Record<string, unknown>) => Promise<{ model: string; response: string; routing: { tier: string; costEstimate: number; savings?: number } }>;
  getSpending: () => { totalUsd: number };
}

async function withSettledCost<T>(client: ChatLikeClient, fn: () => Promise<T>): Promise<{ result: T; settledUsd: number }> {
  const before = client.getSpending().totalUsd;
  const result = await fn();
  const settledUsd = client.getSpending().totalUsd - before;
  return { result, settledUsd };
}

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json, { code: "usage_error" });
  const { message, model, mode, routing, routingProfile, system, maxTokens, temperature, responseFormat, stop, thinking, agent_id, messages } = built.value;

  const estimate = estimateChatCost(maxTokens, mode, model, routing, routingProfile, thinking?.budget_tokens);
  const gated = gatePaidCall(budget, agent_id, estimate, opts.json);
  if (!gated.ok) return gated.outcome;

  const responseFormatOpt = responseFormat ? { type: responseFormat } : undefined;

  try {
    const llm = buildClient() as unknown as ChatLikeClient;

    if (model && /^anthropic\/claude-/.test(model)) {
      if (getChain() === "solana") {
        return fail("Native Anthropic (claude-*) calls currently support Base-chain payment only — your active chain is Solana. Switch with: blockrun wallet --action chain --chain base.", opts.json, { chain: "solana" });
      }
      // Dynamic import: getAnthropicClient is not part of every mocked test surface
      // for shell/wallet.js (some tests mock only buildClient/getChain), so a static
      // named import would break unrelated tests' module mocks.
      const { getAnthropicClient } = await import("../shell/wallet.js");
      const anthropic = getAnthropicClient();

      // Native Anthropic carries `system` as a top-level param, not a message
      // role. Fold any role:"system" history entries into it so nothing is lost.
      const systemParts: string[] = [];
      if (system) systemParts.push(system);

      const apiMessages: Array<{ role: "user" | "assistant"; content: string | Array<Record<string, unknown>> }> = [];
      for (const m of (messages ?? []) as InboundMessage[]) {
        if (m.role === "system") {
          const text = typeof m.content === "string"
            ? m.content
            : m.content.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("\n");
          if (text) systemParts.push(text);
          continue;
        }
        const content = toAnthropicContent(m.content);
        if (Array.isArray(content) && content.length === 0) continue;
        apiMessages.push({ role: m.role, content });
      }
      if (responseFormat === "json_object") {
        systemParts.push("Respond with only valid JSON. Do not wrap it in markdown code fences or add any prose before or after.");
      }
      if (message.trim()) apiMessages.push({ role: "user", content: message });
      if (apiMessages.length === 0) {
        return fail("No message content to send.", opts.json);
      }

      // Anthropic requires max_tokens > thinking.budget_tokens — auto-raise the
      // cap (with headroom for the answer) instead of letting the call 400.
      let effectiveMax = maxTokens;
      if (thinking && effectiveMax <= thinking.budget_tokens) {
        effectiveMax = thinking.budget_tokens + 1024;
      }

      const params: Record<string, unknown> = { model, max_tokens: effectiveMax, messages: apiMessages };
      if (systemParts.length) params.system = systemParts.join("\n\n");
      if (stop && stop.length) params.stop_sequences = stop;
      if (thinking) {
        // Extended thinking requires temperature to be unset (defaults to 1);
        // sending a custom temperature alongside thinking is rejected upstream.
        params.thinking = { type: "enabled", budget_tokens: thinking.budget_tokens };
      } else if (temperature !== undefined) {
        // The schema allows 0-2 (OpenAI range); Anthropic caps temperature at 1.
        params.temperature = Math.max(0, Math.min(1, temperature));
      }

      const native = await anthropic.messages.create(params as never) as {
        model: string;
        content: Array<{ type: string; text?: string; thinking?: string; signature?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      // Book the real cost derived from native token usage, not the flat estimate.
      gated.paid.commit(anthropicCallCost(native.model, native.usage));

      const thinkingBlocks = native.content.filter((b) => b.type === "thinking");
      const textBlocks = native.content.filter((b) => b.type === "text");
      const answerText = textBlocks.map((b) => b.text).join("\n");
      const thinkingText = thinkingBlocks.map((b) => b.thinking).join("\n");
      const signaturePresent = thinkingBlocks.some((b) => typeof b.signature === "string" && b.signature.length > 0);

      return ok(
        {
          requested_model: model,
          // Verbatim upstream model id — proof the call hit real Claude with no
          // substitution. Intentionally NOT rewritten back to the requested id.
          model: native.model,
          response: answerText,
          ...(thinkingText ? { thinking: thinkingText, thinking_blocks: thinkingBlocks, signature_present: signaturePresent } : {}),
          ...(native.stop_reason ? { stop_reason: native.stop_reason } : {}),
          ...(native.usage ? { usage: native.usage } : {}),
        },
        opts.json,
        `[${native.model} | native /v1/messages]\n\n${answerText}`,
      );
    }

    if (routing === "smart") {
      if (messages && messages.length > 0) {
        return fail('routing:"smart" does not support multi-turn messages — smart routing answers a single prompt.', opts.json);
      }
      if (getChain() === "solana") {
        return fail("Smart routing (ClawRouter) is not available on Solana. Use a specific --model or --mode instead.", opts.json, { chain: "solana" });
      }
      if (!llm.smartChat) throw new Error("Smart routing is not available on this client");
      const { result, settledUsd } = await withSettledCost(llm, () => llm.smartChat!(message, {
        system,
        maxTokens,
        temperature,
        routingProfile: routingProfile === "free" ? undefined : routingProfile,
        responseFormat: responseFormatOpt,
        stop,
      }));
      gated.paid.commit(settledUsd || result.routing.costEstimate || estimate);
      return ok(
        { model_used: result.model, response: result.response, routing: result.routing },
        opts.json,
        `[${result.model} | ${result.routing.tier}]\n\n${result.response}`,
      );
    }

    if (messages && messages.length > 0) {
      const targetModel = model || MODEL_TIERS[(mode ?? "balanced") as RoutingMode]?.[0] || "openai/gpt-5.5";
      const fullMessages = [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages,
        { role: "user", content: message },
      ];
      if (!llm.chatCompletion) throw new Error("chatCompletion is not available on this client");
      const { result, settledUsd } = await withSettledCost(llm, () => llm.chatCompletion!(targetModel, fullMessages, {
        maxTokens,
        temperature,
        responseFormat: responseFormatOpt,
        stop,
      }));
      const reply = result.choices?.[0]?.message?.content ?? "";
      gated.paid.commit(settledUsd || estimate);
      return ok(
        { model_used: targetModel, response: reply, message_count: fullMessages.length },
        opts.json,
        `[${targetModel} | ${fullMessages.length} msgs]\n\n${reply}`,
      );
    }

    if (model) {
      const { result: response, settledUsd } = await withSettledCost(llm, () => llm.chat(model, message, {
        system,
        maxTokens,
        temperature,
        responseFormat: responseFormatOpt,
        stop,
      }));
      gated.paid.commit(settledUsd || estimate);
      return ok({ model_used: model, response }, opts.json, response);
    }

    const routingMode: RoutingMode = (mode ?? "balanced") as RoutingMode;
    const candidates = MODEL_TIERS[routingMode] ?? MODEL_TIERS.balanced;
    let lastError: unknown = null;
    for (const m of candidates) {
      try {
        const { result: response, settledUsd } = await withSettledCost(llm, () => llm.chat(m, message, {
          system,
          maxTokens,
          temperature,
          responseFormat: responseFormatOpt,
          stop,
        }));
        gated.paid.commit(settledUsd || estimate);
        return ok({ model_used: m, response }, opts.json, `[${m}]\n\n${response}`);
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    throw new Error(lastError ? extractErrorMessage(lastError) : "All models failed");
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json, { chain: getChain() });
  } finally {
    gated.paid.release();
  }
}
