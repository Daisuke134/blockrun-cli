// REQ-108–119. `blockrun chat`.
import { buildRequest } from "../args/chat.js";
import { estimateChatCost } from "../core/cost/chat.js";
import { MODEL_TIERS, type RoutingMode } from "../core/model-tiers.js";
import { extractErrorMessage, formatError } from "../core/errors.js";
import { buildClient, getChain } from "../shell/wallet.js";
import { ok, fail } from "../core/render.js";
import { gatePaidCall } from "./shared.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

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
  if (!built.ok) return fail(built.error, opts.json);
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
      // for shell/wallet.js (this native-Anthropic path has no test coverage in this
      // suite), so a static named import would break unrelated tests' module mocks.
      const { getAnthropicClient } = await import("../shell/wallet.js");
      const anthropic = getAnthropicClient();
      const before = 0;
      const resp = await anthropic.messages.create({
        model,
        max_tokens: Math.max(maxTokens, (thinking?.budget_tokens ?? 0) + 256),
        system,
        messages: [...(messages ?? []), { role: "user", content: message }] as never,
        ...(thinking ? { thinking: { type: "enabled", budget_tokens: thinking.budget_tokens } } : {}),
        stop_sequences: stop,
      } as never);
      const settledUsd = before;
      gated.paid.commit(settledUsd || estimate);
      const text = (resp as { content?: Array<{ type: string; text?: string }> }).content?.find((b) => b.type === "text")?.text ?? "";
      return ok({ model_used: model, response: text }, opts.json, `[${model}]\n\n${text}`);
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
