#!/usr/bin/env node
// REQ-001, REQ-002, REQ-004, REQ-006–014, REQ-018. Single entrypoint: registers all
// 18 subcommands, wires --json/--budget-limit/--agent-id, resolves the --param-json /
// --param @file.json structured-input forms, and is the ONE real-I/O call site
// (writes stdout/stderr, sets process.exit code) per verification-architecture.md §1.2.
import { Command } from "commander";
import { parseJsonInput } from "./cli/json-flag.js";
import { resolveInvocationBudgetLimit } from "./core/budget-limit.js";
import type { BudgetState } from "./types.js";
import type { CommandOutcome } from "./core/render.js";

import { run as runWallet } from "./commands/wallet.js";
import { run as runChat } from "./commands/chat.js";
import { run as runModels } from "./commands/models.js";
import { run as runImage } from "./commands/image.js";
import { run as runVideo } from "./commands/video.js";
import { run as runRealface } from "./commands/realface.js";
import { run as runMusic } from "./commands/music.js";
import { run as runSpeech } from "./commands/speech.js";
import { run as runSearch } from "./commands/search.js";
import { run as runExa } from "./commands/exa.js";
import { run as runMarkets } from "./commands/markets.js";
import { run as runPrice } from "./commands/price.js";
import { run as runDex } from "./commands/dex.js";
import { run as runRpc } from "./commands/rpc.js";
import { run as runDefi } from "./commands/defi.js";
import { run as runModal } from "./commands/modal.js";
import { run as runPhone } from "./commands/phone.js";
import { run as runSurf } from "./commands/surf.js";
import { buildCommandsCatalog } from "./core/commands-catalog.js";
import { renderCommandsOutcome } from "./core/commands-render.js";

type RunFn = (flags: Record<string, unknown>, opts: { json: boolean }, budget: BudgetState) => Promise<CommandOutcome>;

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return n;
}

/** Resolves a JSON-typed CLI field from either `--field <json-or-@file>` or the
 *  explicit `--field-json <json>` form (REQ-004). */
function jsonFlag(raw: string | undefined, jsonRaw: string | undefined): unknown {
  if (jsonRaw !== undefined) return parseJsonInput(jsonRaw);
  if (raw !== undefined) {
    if (raw.startsWith("@")) return parseJsonInput(raw);
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

function csv(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : v.split(",").map((s) => s.trim()).filter(Boolean);
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

function writeOutcome(outcome: CommandOutcome): never {
  if (outcome.stdout) process.stdout.write(outcome.stdout.endsWith("\n") ? outcome.stdout : `${outcome.stdout}\n`);
  if (outcome.stderr) process.stderr.write(outcome.stderr.endsWith("\n") ? outcome.stderr : `${outcome.stderr}\n`);
  process.exit(outcome.exitCode);
}

function budgetState(budgetLimitFlag: number | undefined): BudgetState {
  const limit = resolveInvocationBudgetLimit(budgetLimitFlag, process.env.BLOCKRUN_BUDGET_LIMIT);
  return { limit, spent: 0, calls: 0, agents: new Map() };
}

function dispatch(run: RunFn, json: boolean, budgetLimit: number | undefined, flags: Record<string, unknown>): void {
  run(flags, { json }, budgetState(budgetLimit))
    .then((outcome) => writeOutcome(outcome))
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      writeOutcome(json
        ? { exitCode: 1, stdout: JSON.stringify({ error: true, message: `Error: ${message}` }), stderr: "" }
        : { exitCode: 1, stdout: "", stderr: `Error: ${message}` });
    });
}

const program = new Command();
program
  .name("blockrun")
  .description("CLI for the 18 blockrun-mcp tools, backed by @blockrun/llm (x402 micropayments on Base/Solana).")
  .version("1.1.0");

function withCommon(cmd: Command): Command {
  return cmd
    .option("--json", "emit machine-readable JSON to stdout")
    .option("--budget-limit <usd>", "cap this invocation's paid call(s) at $usd (ephemeral, not persisted)");
}

function withAgentId(cmd: Command): Command {
  return cmd.option("--agent-id <id>", "agent identifier for budget tracking (see: blockrun wallet --action delegate)");
}

// ---- wallet ----
withCommon(program.command("wallet"))
  .description("Manage the BlockRun wallet: balances, active chain, spend budgets, agent delegation.")
  .option("--action <action>", "status|deposit|setup|qr|chain|budget|delegate|revoke|report", "status")
  .option("--chain <chain>", "base|solana (for --action chain)")
  .option("--budget-action <action>", "set|check|clear (for --action budget)")
  .option("--budget-amount <usd>", "budget limit in USD (for --budget-action set)")
  .option("--agent-id <id>", "agent id (for delegate/revoke/report)")
  .option("--agent-limit <usd>", "budget limit in USD for --action delegate")
  .option("--open", "for --action deposit: open the minted Coinbase Onramp link in your browser (default: printed only)")
  .action((opts) => {
    dispatch(runWallet, Boolean(opts.json), num(opts.budgetLimit), {
      action: opts.action,
      chain: opts.chain,
      budgetAction: opts.budgetAction,
      budgetAmount: num(opts.budgetAmount),
      agentId: opts.agentId,
      agentLimit: num(opts.agentLimit),
      open: opts.open ? true : undefined,
    });
  });

// ---- chat ----
withAgentId(withCommon(program.command("chat")))
  .description("Chat with any AI model. $0 on mode=free / nvidia/* models.")
  .argument("[message]", "your message (alias for --message)")
  .option("--message <text>", "your message to the AI")
  .option("--model <id>", "specific model id, e.g. zai/glm-5, openai/o3")
  .option("--mode <mode>", "fast|balanced|powerful|cheap|reasoning|free|coding|glm")
  .option("--routing <mode>", 'set to "smart" for ClawRouter auto-selection')
  .option("--routing-profile <profile>", "free|eco|auto|premium (default auto)")
  .option("--system <text>", "system prompt")
  .option("--max-tokens <n>", "max response tokens (default 1024)")
  .option("--temperature <n>", "0-2 (default 1)")
  .option("--response-format <fmt>", "text|json_object")
  .option("--stop <seq>", "stop sequence (repeatable, up to 4)", collect, [] as string[])
  .option("--thinking <json-or-@file>", "Anthropic extended thinking object {type,budget_tokens}")
  .option("--thinking-json <json>", "same as --thinking, always parsed as inline JSON")
  .option("--thinking-budget-tokens <n>", "alias: compiles into --thinking (1024-100000)")
  .option("--messages <json-or-@file>", "conversation history array")
  .option("--messages-json <json>", "same as --messages, always parsed as inline JSON")
  .action((message, opts) => {
    dispatch(runChat, Boolean(opts.json), num(opts.budgetLimit), {
      $positional: message !== undefined ? [message] : [],
      message: opts.message,
      model: opts.model,
      mode: opts.mode,
      routing: opts.routing,
      routingProfile: opts.routingProfile,
      system: opts.system,
      maxTokens: num(opts.maxTokens),
      temperature: num(opts.temperature),
      responseFormat: opts.responseFormat,
      stop: opts.stop && opts.stop.length > 0 ? opts.stop : undefined,
      thinking: jsonFlag(opts.thinking, opts.thinkingJson),
      thinkingBudgetTokens: num(opts.thinkingBudgetTokens),
      messages: jsonFlag(opts.messages, opts.messagesJson),
      agentId: opts.agentId,
    });
  });

// ---- models ----
withCommon(program.command("models"))
  .description("List available AI models with pricing. Free.")
  .option("--category <cat>", "all|chat|reasoning|image|embedding", "all")
  .option("--provider <name>", "filter by provider prefix, e.g. openai")
  .action((opts) => {
    dispatch(runModels, Boolean(opts.json), num(opts.budgetLimit), {
      category: opts.category,
      provider: opts.provider,
    });
  });

// ---- image ----
withAgentId(withCommon(program.command("image")))
  .description("Generate or edit images. $0.015-$0.15/image depending on model/size.")
  .argument("[prompt]", "image description (alias for --prompt)")
  .option("--prompt <text>", "image description or edit instructions")
  .option("--action <action>", "generate|edit", "generate")
  .option("--model <id>", "e.g. openai/gpt-image-2 (default), zai/cogview-4, google/nano-banana")
  .option("--image <ref>", "source image for edit: data URI, URL, or local path (repeatable, up to 4)", collect, [] as string[])
  .option("--mask <ref>", "inpaint mask (openai models only)")
  .option("--size <wxh>", "e.g. 1024x1024 (default), 1536x1024", "1024x1024")
  .option("--quality <q>", "standard|hd", "standard")
  .option("--inline", "also return a small inline preview")
  .action((prompt, opts) => {
    dispatch(runImage, Boolean(opts.json), num(opts.budgetLimit), {
      $positional: prompt !== undefined ? [prompt] : [],
      prompt: opts.prompt,
      action: opts.action,
      model: opts.model,
      image: opts.image && opts.image.length > 0 ? (opts.image.length === 1 ? opts.image[0] : opts.image) : undefined,
      mask: opts.mask,
      size: opts.size,
      quality: opts.quality,
      inline: opts.inline ? true : undefined,
      agentId: opts.agentId,
    });
  });

// ---- video ----
withAgentId(withCommon(program.command("video")))
  .description("Generate a short AI video. $0.05-$0.30/sec depending on model.")
  .argument("[prompt]", "video description (alias for --prompt)")
  .option("--prompt <text>", "video description")
  .option("--image-url <url>", "seed image for image-to-video")
  .option("--real-face-asset-id <id>", "BytePlus RealFace asset id (ta_xxxx), Seedance 2.0 family only")
  .option("--duration-seconds <n>", "1-60 (model-specific default; azure/sora-2 requires 4|8|12)")
  .option("--generate-audio", "generate a synced audio track (Seedance only)")
  .option("--resolution <res>", "360p|480p|540p|720p|1080p|1K|2K|4K (Seedance only)")
  .option("--aspect-ratio <ar>", "adaptive|16:9|9:16|1:1|4:3|3:4|21:9|9:21 (Seedance only)")
  .option("--last-frame-url <url>", "first-and-last-frame interpolation (requires --image-url)")
  .option("--model <id>", "azure/sora-2|xai/grok-imagine-video (default)|bytedance/seedance-1.5-pro|bytedance/seedance-2.0-fast|bytedance/seedance-2.0")
  .option("--max-quote-usd <usd>", "abort before signing if the real 402 quote exceeds this")
  .action((prompt, opts) => {
    dispatch(runVideo, Boolean(opts.json), num(opts.budgetLimit), {
      $positional: prompt !== undefined ? [prompt] : [],
      prompt: opts.prompt,
      imageUrl: opts.imageUrl,
      realFaceAssetId: opts.realFaceAssetId,
      durationSeconds: num(opts.durationSeconds),
      generateAudio: opts.generateAudio ? true : undefined,
      resolution: opts.resolution,
      aspectRatio: opts.aspectRatio,
      lastFrameUrl: opts.lastFrameUrl,
      model: opts.model,
      maxQuoteUsd: num(opts.maxQuoteUsd),
      agentId: opts.agentId,
    });
  });

// ---- realface ----
withAgentId(withCommon(program.command("realface")))
  .description("Enroll a real/AI face as a RealFace asset for blockrun video. init/status/list free; enroll/portrait $0.01.")
  .option("--action <action>", "init|status|enroll|portrait|list")
  .option("--name <name>", "display name (1-64 chars)")
  .option("--group-id <id>", "asset-group id from init, e.g. legacy_rf_123")
  .option("--image-url <url>", "public URL of a face image")
  .action((opts) => {
    dispatch(runRealface, Boolean(opts.json), num(opts.budgetLimit), {
      action: opts.action,
      name: opts.name,
      groupId: opts.groupId,
      imageUrl: opts.imageUrl,
      agentId: opts.agentId,
    });
  });

// ---- music ----
withAgentId(withCommon(program.command("music")))
  .description("Generate a ~3min music track. Flat $0.1575.")
  .argument("[prompt]", "style/mood/description (alias for --prompt)")
  .option("--prompt <text>", "style, mood, or description")
  .option("--no-instrumental", "generate with vocals (requires --lyrics)")
  .option("--lyrics <text>", "custom lyrics (requires --no-instrumental)")
  .option("--model <id>", "minimax/music-2.5+ (default)|minimax/music-2.5")
  .action((prompt, opts) => {
    dispatch(runMusic, Boolean(opts.json), num(opts.budgetLimit), {
      $positional: prompt !== undefined ? [prompt] : [],
      prompt: opts.prompt,
      instrumental: opts.instrumental,
      lyrics: opts.lyrics,
      model: opts.model,
      agentId: opts.agentId,
    });
  });

// ---- speech ----
withAgentId(withCommon(program.command("speech")))
  .description("Text-to-speech, sound effects, or list voices. voices is free.")
  .argument("[input]", "text to synthesize (alias for --input)")
  .option("--input <text>", "text to synthesize / sound description")
  .option("--action <action>", "speak|sound_effect|voices", "speak")
  .option("--voice <alias-or-id>", "e.g. sarah (default), george, laura")
  .option("--model <id>", "elevenlabs/flash-v2.5 (default)|turbo-v2.5|multilingual-v2|v3")
  .option("--response-format <fmt>", "mp3|opus|pcm|wav", "mp3")
  .option("--speed <n>", "0.7-1.2")
  .option("--duration-seconds <n>", "0.5-22 (sound_effect only)")
  .option("--prompt-influence <n>", "0-1 (sound_effect only)")
  .action((input, opts) => {
    dispatch(runSpeech, Boolean(opts.json), num(opts.budgetLimit), {
      $positional: input !== undefined ? [input] : [],
      input: opts.input,
      action: opts.action,
      voice: opts.voice,
      model: opts.model,
      responseFormat: opts.responseFormat,
      speed: num(opts.speed),
      durationSeconds: num(opts.durationSeconds),
      promptInfluence: num(opts.promptInfluence),
      agentId: opts.agentId,
    });
  });

// ---- search ----
withAgentId(withCommon(program.command("search")))
  .description("Grok Live Search — real-time web/X/news. $0.025 x max-results (default 10 -> $0.25).")
  .option("--query <text>", "search query (alias for body.query)")
  .option("--sources <list>", "csv subset of web,x,news (alias for body.sources)")
  .option("--max-results <n>", "1-50 (alias for body.max_results, drives price)")
  .option("--from-date <date>", "YYYY-MM-DD (alias for body.from_date)")
  .option("--to-date <date>", "YYYY-MM-DD (alias for body.to_date)")
  .option("--body <json-or-@file>", "full request body, minimum {query}")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .option("--path <path>", "sub-path under /v1/search/ (reserved, default root)")
  .action((opts) => {
    dispatch(runSearch, Boolean(opts.json), num(opts.budgetLimit), {
      query: opts.query,
      sources: csv(opts.sources),
      maxResults: num(opts.maxResults),
      fromDate: opts.fromDate,
      toDate: opts.toDate,
      body: jsonFlag(opts.body, opts.bodyJson),
      path: opts.path,
      agentId: opts.agentId,
    });
  });

// ---- exa ----
withAgentId(withCommon(program.command("exa")))
  .description("Neural web search via Exa. $0.01/call flat, contents $0.002/url.")
  .option("--path <path>", "search|answer|contents|find-similar")
  .option("--query <text>", "alias for body.query (search/answer)")
  .option("--num-results <n>", "alias for body.numResults (search/find-similar)")
  .option("--category <cat>", "alias for body.category (search): news|research paper|company|tweet|github|pdf")
  .option("--include-domains <list>", "csv, alias for body.includeDomains (search)")
  .option("--exclude-domains <list>", "csv, alias for body.excludeDomains (search)")
  .option("--urls <list>", "csv, alias for body.urls (contents, up to 100)")
  .option("--url <text>", "alias for body.url (find-similar)")
  .option("--body <json-or-@file>", "full request body")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .action((opts) => {
    dispatch(runExa, Boolean(opts.json), num(opts.budgetLimit), {
      path: opts.path,
      query: opts.query,
      numResults: num(opts.numResults),
      category: opts.category,
      includeDomains: csv(opts.includeDomains),
      excludeDomains: csv(opts.excludeDomains),
      urls: csv(opts.urls),
      url: opts.url,
      body: jsonFlag(opts.body, opts.bodyJson),
      agentId: opts.agentId,
    });
  });

// ---- markets ----
withAgentId(withCommon(program.command("markets")))
  .description("Prediction market + derivatives data (Predexon). $0.001-$0.005/call.")
  .option("--path <path>", "e.g. polymarket/events, kalshi/markets")
  .option("--params <json-or-@file>", "query params for GET")
  .option("--params-json <json>", "same as --params, always parsed as inline JSON")
  .option("--body <json-or-@file>", "JSON body for POST queries")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .action((opts) => {
    dispatch(runMarkets, Boolean(opts.json), num(opts.budgetLimit), {
      path: opts.path,
      params: jsonFlag(opts.params, opts.paramsJson),
      body: jsonFlag(opts.body, opts.bodyJson),
      agentId: opts.agentId,
    });
  });

// ---- price ----
withAgentId(withCommon(program.command("price")))
  .description("Quotes/history for crypto, FX, commodities, stocks. Free except stocks ($0.001).")
  .option("--action <action>", "price|history|list")
  .option("--category <cat>", "crypto|fx|commodity|usstock|stocks")
  .option("--symbol <sym>", "e.g. BTC-USD, AAPL")
  .option("--market <mkt>", "us|hk|jp|kr|gb|de|fr|nl|ie|lu|cn|ca (required for stocks)")
  .option("--session <s>", "pre|post|on")
  .option("--resolution <r>", "1|5|15|60|240|D|W|M (default D)")
  .option("--from <unix>", "history window start (unix seconds)")
  .option("--to <unix>", "history window end (unix seconds)")
  .option("--query <text>", "free-text filter for list")
  .option("--limit <n>", "max items for list (default 100, max 2000)")
  .action((opts) => {
    dispatch(runPrice, Boolean(opts.json), num(opts.budgetLimit), {
      action: opts.action,
      category: opts.category,
      symbol: opts.symbol,
      market: opts.market,
      session: opts.session,
      resolution: opts.resolution,
      from: num(opts.from),
      to: num(opts.to),
      query: opts.query,
      limit: num(opts.limit),
      agentId: opts.agentId,
    });
  });

// ---- dex ----
withCommon(program.command("dex"))
  .description("DEX pairs via DexScreener. Free.")
  .option("--query <text>", "token name/symbol/address search")
  .option("--token <address>", "direct token address lookup")
  .option("--symbol <sym>", "token symbol to search")
  .option("--chain <chain>", "filter by chain (ethereum, solana, base, ...)")
  .action((opts) => {
    dispatch(runDex, Boolean(opts.json), num(opts.budgetLimit), {
      query: opts.query,
      token: opts.token,
      symbol: opts.symbol,
      chain: opts.chain,
    });
  });

// ---- rpc ----
withAgentId(withCommon(program.command("rpc")))
  .description("Raw JSON-RPC across 40+ chains. $0.002/call (batch charges per element).")
  .option("--network <chain>", "e.g. ethereum, base, solana, bitcoin")
  .option("--method <name>", "JSON-RPC method, e.g. eth_blockNumber")
  .option("--params <json-or-@file>", "JSON-RPC params array")
  .option("--params-json <json>", "same as --params, always parsed as inline JSON")
  .option("--body <json-or-@file>", "full JSON-RPC 2.0 body or batch array (overrides --method/--params)")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .action((opts) => {
    dispatch(runRpc, Boolean(opts.json), num(opts.budgetLimit), {
      network: opts.network,
      method: opts.method,
      params: jsonFlag(opts.params, opts.paramsJson),
      body: jsonFlag(opts.body, opts.bodyJson),
      agentId: opts.agentId,
    });
  });

// ---- defi ----
withAgentId(withCommon(program.command("defi")))
  .description("DefiLlama TVL/yields/prices. $0.001 (prices) or $0.005.")
  .option("--path <path>", "e.g. protocols, protocol/aave-v3, chains, yields, prices/coingecko:bitcoin")
  .action((opts) => {
    dispatch(runDefi, Boolean(opts.json), num(opts.budgetLimit), {
      path: opts.path,
      agentId: opts.agentId,
    });
  });

// ---- modal ----
withAgentId(withCommon(program.command("modal")))
  .description("Run code in a disposable Modal sandbox. $0.01 create, $0.001 exec/status/terminate.")
  .option("--path <path>", "sandbox/create|sandbox/exec|sandbox/status|sandbox/terminate")
  .option("--body <json-or-@file>", "JSON body")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .action((opts) => {
    dispatch(runModal, Boolean(opts.json), num(opts.budgetLimit), {
      path: opts.path,
      body: jsonFlag(opts.body, opts.bodyJson),
      agentId: opts.agentId,
    });
  });

// ---- phone ----
withAgentId(withCommon(program.command("phone")))
  .description("Phone intelligence, number provisioning, AI voice calls. $0-$5.54 by path.")
  .option("--path <path>", "e.g. phone/lookup, phone/numbers/list, voice/call")
  .option("--body <json-or-@file>", "JSON body (POST); omit for a free GET poll")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .action((opts) => {
    dispatch(runPhone, Boolean(opts.json), num(opts.budgetLimit), {
      path: opts.path,
      body: jsonFlag(opts.body, opts.bodyJson),
      agentId: opts.agentId,
    });
  });

// ---- surf ----
withAgentId(withCommon(program.command("surf")))
  .description("Unified crypto data (asksurf.ai), 84 endpoints. $0.001/$0.005/$0.02 tiers.")
  .option("--path <path>", "e.g. market/price, onchain/sql, chat/completions")
  .option("--params <json-or-@file>", "query params for GET")
  .option("--params-json <json>", "same as --params, always parsed as inline JSON")
  .option("--body <json-or-@file>", "JSON body for POST (routes the call as POST)")
  .option("--body-json <json>", "same as --body, always parsed as inline JSON")
  .action((opts) => {
    dispatch(runSurf, Boolean(opts.json), num(opts.budgetLimit), {
      path: opts.path,
      params: jsonFlag(opts.params, opts.paramsJson),
      body: jsonFlag(opts.body, opts.bodyJson),
      agentId: opts.agentId,
    });
  });

// ---- commands (REQ-DX-001..008) ----
// Deliberately NOT withCommon() — REQ-DX-008: no --budget-limit/--agent-id, both
// meaningless for a free, local-only, no-network introspection command
// (REQ-DX-NG-005). Registered last so program.commands already reflects all 18
// subcommands when this action runs (order doesn't strictly matter — actions run
// after the whole module has loaded — but this keeps registration order == help order).
program
  .command("commands")
  .description("List all subcommands as a machine-readable catalog: name, description, cost model, flags.")
  .option("--json", "emit machine-readable JSON to stdout")
  .action((opts) => {
    const catalog = buildCommandsCatalog(program);
    writeOutcome(renderCommandsOutcome(catalog, Boolean(opts.json)));
  });

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
