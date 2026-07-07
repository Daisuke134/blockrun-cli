# blockrun-cli — Behavioral Specification (EARS)

Feature: `blockrun-cli` · Mode: strict · Language: TypeScript
Grounding: `blockrun-mcp` v0.28.0 clone at `/private/tmp/claude-501/-Users-anicca-anicca-project/ec3606df-8de7-491a-8a92-7ee667020d6a/scratchpad/blockrun-mcp` (`src/tools/*.ts`, `src/utils/*.ts`, `README.md`, `CONTRIBUTING.md`, `package.json`), and `@blockrun/llm` SDK v2.13.0 (`dist/index.d.ts`, installed at `/opt/homebrew/lib/node_modules/@blockrun/franklin/node_modules/@blockrun/llm`; `package.json` pins `^2.11.0`, 2.13.0 is semver-compatible).

Every requirement is a MUST. There are no optional/recommended items in this document.

---

## 0. Scope

`blockrun-cli` is a Node.js/TypeScript CLI that exposes the 18 MCP tools registered in `blockrun-mcp`'s `full` profile (`src/mcp-handler.ts:56-75`, `src/profiles.ts:34-37`) as 18 top-level subcommands of one binary (`blockrun`), 1:1 in parameter surface, by wrapping `@blockrun/llm` — never reimplementing x402 signing or wallet management (per CONTRIBUTING.md "Adding a new MCP tool" step 2: use `getClient()`-equivalent wrappers).

### Non-goals (REQ-NG-*)

- REQ-NG-001: The system SHALL NOT implement an MCP server mode (stdio/SSE). It is a CLI only.
- REQ-NG-002: The system SHALL NOT publish to npm as part of this feature.
- REQ-NG-003: The system SHALL NOT introduce new payment rails, chains, or settlement logic beyond what `@blockrun/llm` already implements for Base and Solana.
- REQ-NG-004: A REPL/interactive shell mode is out of scope; every invocation is a single non-interactive subcommand.
- REQ-NG-005: The system SHALL NOT be implemented in Python or any language other than TypeScript.
- REQ-NG-006: Tool *profiles* (`media`/`trading`/`research`/`chat` from `blockrun-mcp`'s `src/profiles.ts`) are out of scope — the CLI always exposes all 18 commands; profile-based command filtering is not required.

---

## 1. Global CLI behavior

### 1.1 Command structure

- REQ-001: WHEN the package is installed or run via `npx`, THE SYSTEM SHALL expose a single binary named `blockrun` (package.json `bin.blockrun`), matching the MCP server's package identity (`blockrun-mcp` package.json `bin["blockrun-mcp"]`, `mcp-handler.ts` tool prefix `blockrun_*`).
- REQ-002: THE SYSTEM SHALL register exactly 18 subcommands, one per MCP tool, named by stripping the `blockrun_` prefix: `wallet`, `chat`, `models`, `image`, `video`, `realface`, `music`, `speech`, `search`, `exa`, `markets`, `price`, `dex`, `rpc`, `defi`, `modal`, `phone`, `surf` (source: `mcp-handler.ts:56-75` registrar map keys).
- REQ-003: WHEN a subcommand's parameter surface is defined, THE SYSTEM SHALL mirror the corresponding tool's zod `inputSchema` from the clone 1:1 — same parameter names, same enum value sets, same defaults, same optionality — validated locally with zod before any network call.
- REQ-004: THE SYSTEM SHALL accept parameters as CLI flags (`--param value` / `--param=value`); array/object-typed parameters (e.g. `chat --messages`, `surf --params`, `video` body-shaped fields) SHALL additionally accept a `--param-json '<json>'` form or a `--param @file.json` form for structured input, since a flag cannot naturally express nested JSON.
- REQ-004a: THE SYSTEM SHALL apply ONE global naming convention, stated here once (not repeated per command): every CLI flag is the kebab-case form of the source tool's exact zod field name (all 18 tools' field names are snake_case or single words — none use camelCase) — e.g. `duration_seconds` ↔ `--duration-seconds`, `image_url` ↔ `--image-url`, `agent_id` ↔ `--agent-id`, `real_face_asset_id` ↔ `--real-face-asset-id`. THE SYSTEM SHALL preserve the ORIGINAL snake_case field name (never renamed to camelCase or kebab-case) as the key in every `--json` output object, since `--json` output mirrors the source API's response shape verbatim (e.g. `cost_usd`, `request_id`, `real_face_asset_id` in JSON output). Both directions — the kebab-case CLI flag name for input, and the snake_case JSON field name for output — SHALL be covered by tests (Tier 1 for the flag→request mapping, Tier 2 for the `--json` output shape), per verification-architecture.md.
- REQ-005: THE SYSTEM SHALL NOT require any parameter that the source tool's zod schema marks `.optional()`.

### 1.2 Output contract

- REQ-006: WHEN a command is invoked with `--json`, THE SYSTEM SHALL write ONLY a single JSON document to stdout (parseable by `JSON.parse` on the full stdout capture) and SHALL write all logs, progress indicators, and diagnostic text to stderr.
- REQ-007: WHEN a command is invoked WITHOUT `--json`, THE SYSTEM SHALL render a human-readable rendering of the result to stdout (may reuse the source tool's `content[0].text` formatting, e.g. the cost-footer lines in `video.ts:324-333`, `music.ts:205-215`, `speech.ts:222-233`) and MAY still write progress/log lines to stderr.
- REQ-008: WHEN a command succeeds, THE SYSTEM SHALL exit with code 0.
- REQ-009: WHEN a command fails (validation error, network error, gateway error, payment error, budget-exceeded error), THE SYSTEM SHALL exit with a nonzero code.
- REQ-010: WHEN a command fails AND `--json` was passed, THE SYSTEM SHALL emit a structured JSON error object to stdout of the shape `{ "error": true, "message": string, "code"?: string }`, mirroring the source tools' `isError: true` + `formatError()` text (`src/utils/errors.ts:57-103`) collapsed into one field.
- REQ-011: WHEN a command fails AND `--json` was NOT passed, THE SYSTEM SHALL print the human-readable error text (equivalent to `formatError()` output) to stderr.

### 1.3 Help

- REQ-012: WHEN invoked with `--help` or `-h` at the root, THE SYSTEM SHALL list all 18 subcommands with a one-line description each.
- REQ-013: WHEN invoked with `<subcommand> --help`, THE SYSTEM SHALL print that subcommand's flags, each flag's type/enum/default, and a cost note where the source tool description states a fixed or tiered price (e.g. surf's $0.001/$0.005/$0.02 tiers from `surf.ts:88-91`, phone's per-endpoint prices from `phone.ts:44-56`).
- REQ-014: Each subcommand's `--help` output SHALL be concise: no more than roughly 30 lines of body text (excluding the flag table), mirroring CONTRIBUTING.md's "Tool description ≤ 30 lines" rule so long catalogs (surf's 84 endpoints, markets' full path list) are summarized with a pointer, not reproduced in full.

### 1.4 Configuration / wallet

- REQ-015: THE SYSTEM SHALL locate the wallet exactly where `@blockrun/llm` does: `~/.blockrun/.session` (Base EVM key, `WALLET_FILE_PATH`) and `~/.blockrun/.solana-session` (Solana key, `SOLANA_WALLET_FILE_PATH`), auto-created on first use via the SDK's `getOrCreateWallet()` / `getOrCreateSolanaWallet()` — the CLI SHALL NOT implement its own key generation, storage, or file format.
- REQ-016: THE SYSTEM SHALL resolve the active payment chain using the exact precedence implemented in `blockrun-mcp/src/utils/wallet.ts:48-73`: (1) `~/.blockrun/.chain` or `~/.blockrun/payment-chain` if set to `base`|`solana`; (2) `SOLANA_WALLET_KEY` env var present → solana; (3) non-empty `~/.blockrun/.solana-session` exists → solana; (4) else base.
- REQ-016a: THE SYSTEM SHALL create the Solana wallet file (`~/.blockrun/.solana-session`) ONLY when Solana is the explicitly-selected or required chain — an explicit `~/.blockrun/.chain` or `~/.blockrun/payment-chain` set to `solana`, or `SOLANA_WALLET_KEY` present, or a command/action the user directs at Solana (e.g. `wallet --action chain --chain solana`) — and SHALL NOT create it as an unconditional side-effect of view-only or Base-default operations. RATIONALE: `blockrun-mcp` eagerly ensures BOTH wallets at startup (`utils/wallet.ts`'s `ensureBothWallets()`, called from `tools/wallet.ts:150-155` before `getChain()` runs), which is harmless in the MCP server's single long-lived process — but under the CLI's one-shot-process model (REQ-NG-004: no REPL, every invocation is a fresh process) that eager dual-ensure would make REQ-016's own precedence rule (3) (".solana-session exists → solana") self-trigger on a fresh user's very first invocation, permanently rerouting their default chain to Solana and breaking every Base-only paid command (`video`/`music`/`speech`/`realface`). This REQ makes Solana-wallet creation ON-DEMAND so REQ-016's precedence stays literally correct while fresh state resolves to Base as intended. This is a DECIDED CLI-specific adaptation, not an open question.
- REQ-017: THE SYSTEM SHALL NOT invent or read a `BLOCKRUN_HOME` (or any other CLI-specific config-dir override) environment variable — this is a single, non-contradictory rule superseding any prior draft. Ground truth: `@blockrun/llm` v2.13.0's compiled `dist/index.js` hardcodes `path.join(os.homedir(), ".blockrun")` for every wallet/config file path (confirmed at lines 348, 4643, 4793, 5494-5496) with NO override of its own. THE SYSTEM SHALL achieve hermetic config/wallet isolation (needed for Tier-3 E2E, see verification-architecture.md §4.1) SOLELY by being spawned with a different standard `HOME` (POSIX) environment variable — since Node's `os.homedir()` resolves via `process.env.HOME` — documented in the CLI's own README/test-harness instructions as an OPERATIONAL technique for callers, NOT implemented as CLI code (no `BLOCKRUN_HOME` read anywhere in `src/`).

### 1.5 Budget / cost tracking

- REQ-018: THE SYSTEM SHALL support a GLOBAL `--budget-limit <number>` flag, accepted by every one of the 18 commands, that caps ONLY the current single invocation's paid call(s). Precedence for this PER-INVOCATION cap: `--budget-limit <n>` flag (highest) > `BLOCKRUN_BUDGET_LIMIT` env var (parsed via the same tolerant parser as `blockrun-mcp`'s `parseBudgetLimitEnv` — accepts `"5"`, `"5.00"`, `"$5"`; non-positive/junk → unlimited) > unlimited (no per-invocation cap). This cap is EPHEMERAL — it is never read from or written to the persisted ledger (REQ-019) — it exists purely as a same-process safety rail, independent of and checked ADDITIONALLY to the persisted global/per-agent limits in REQ-019c.
- REQ-019: THE SYSTEM SHALL persist a cumulative budget ledger to `~/.blockrun/cli-budget.json`. This is a DELIBERATE CLI-specific adaptation of `blockrun-mcp`'s in-memory-only `BudgetState` (`src/types.ts`, `src/utils/budget.ts`): the MCP server holds one long-lived process per session, so an in-process ledger is meaningful there, but each CLI invocation is instead a fresh one-shot process (REQ-NG-004: no REPL) — so `wallet --action budget/delegate/revoke/report` would be meaningless across invocations without disk persistence. The `wallet` command's `action` enum itself (`status`/`deposit`/`setup`/`qr`/`chain`/`budget`/`delegate`/`revoke`/`report`) remains 1:1 with `wallet.ts` — ONLY the storage backing changes (a JSON file instead of an in-memory `Map`), never the action semantics.
- REQ-019a: `~/.blockrun/cli-budget.json` schema: `{ "version": 1, "global": { "limit": number|null, "spent": number, "calls": number }, "agents": { "<agent_id>": { "limit": number, "spent": number, "calls": number } }, "updatedAt": "<ISO-8601 string>" }` — mirrors `BudgetState`'s shape (`limit`/`spent`/`calls`/per-agent map) from `src/types.ts`, with the `agents` `Map` serialized as a plain object keyed by `agent_id`. WHEN the file does not yet exist, THE SYSTEM SHALL treat it as `{ version:1, global:{ limit: <seeded from BLOCKRUN_BUDGET_LIMIT env if set and positive, else null>, spent:0, calls:0 }, agents:{}, updatedAt:<now> }` and create it on first write. Once `~/.blockrun/cli-budget.json` EXISTS, a LATER change to the `BLOCKRUN_BUDGET_LIMIT` env var SHALL have NO effect on the already-persisted `global.limit` — the env var seeds `global.limit` ONLY at file-creation time (the one-time initialization above); thereafter, `global.limit` is changed ONLY by `wallet --action budget --budget-action set/clear` (REQ-103, persisted per REQ-107a) or left untouched by ordinary spend accounting (REQ-019c). This is a single explicit clause so neither the implementer nor the verifier needs to infer it from REQ-018's separate (and intentionally unrelated) per-invocation `--budget-limit`/env precedence.
- REQ-019b: Every WRITE to `~/.blockrun/cli-budget.json` (from `wallet budget set/clear`, `wallet delegate/revoke`, or any paid command's real settled spend) SHALL be atomic: write the full new contents to a sibling temp file in the same directory (e.g. `cli-budget.json.tmp-<pid>`), then `rename()` it over the target — a concurrent reader SHALL never observe a partial/truncated write.
- REQ-019c: WHEN any of the 17 non-`wallet` commands whose operation has a cost settles a REAL spend, THE SYSTEM SHALL read the current persisted ledger, apply the SAME `checkBudget`/`recordActualSpend` logic ported from `budget.ts` against the persisted `global` limit and the matching `agents[agent_id]` entry (when either is set), and atomically write the updated ledger back (REQ-019b) BEFORE reporting success. WHEN the persisted global or per-agent limit (if set) would be exceeded by the pre-call estimate, THE SYSTEM SHALL reject the call locally with no network call — checked INDEPENDENTLY of and in addition to the per-invocation `--budget-limit`/env cap (REQ-018); either cap failing blocks the call.
- REQ-020: WHEN a command's operation has a known fixed or tiered price (per the pricing tables read from the clone's source, enumerated per-command in section 2), THE SYSTEM SHALL estimate cost using the SAME pure functions ported from the clone (`estimateSurfCost`, `estimateExaCost`, `estimateDefiCost`, `estimateMarketCost`, `estimateModalCost`, `estimatePhoneCost`, `estimateSearchCost`, `estimateChatCost`, `estimateCost` for images, `speechCost` for speech — `speech.ts:54-58`) before making the network call, and SHALL reject the call locally (nonzero exit, no network call) if EITHER the per-invocation cap (REQ-018) OR the persisted global/per-agent cap (REQ-019c) would be exceeded by the estimate.
- REQ-021: WHEN the real settled cost differs from the estimate (available from a 402 quote or `client.getSpending()` delta, per `budget.ts` `recordActualSpend`/`amountToUsd`), THE SYSTEM SHALL report the ACTUAL settled cost in both the human-readable output and the `--json` output, not the pre-call estimate.

### 1.6 Schema fidelity & aliases

- REQ-022: For EVERY one of the 18 commands, THE SYSTEM'S canonical parameter surface SHALL be the EXACT field set of the corresponding source tool's zod `inputSchema` — including `agent_id` on every tool whose schema declares it (all 18 tools except `wallet`, `models`, and `dex`, whose schemas have no `agent_id` field; `wallet` instead declares `agent_id`/`agent_limit` scoped to its `delegate`/`revoke`/`report` actions, per REQ-104). No command's specification in section 2 SHALL omit a canonical field present in the source schema.
- REQ-023: An ergonomic CLI convenience form that does NOT correspond 1:1 to a source zod field's canonical FLAG name — whether it is a body-shape convenience flag (e.g. `search`'s documented `query`/`sources`/`max_results`/`from_date`/`to_date` convention, `exa`'s per-path conventions, `chat`'s `--thinking-budget-tokens`) OR a bare POSITIONAL argument standing in for a required canonical scalar (e.g. `image`/`video`/`music`'s `<prompt>`, `speech`'s `<input>`, `chat`'s `<message>`) — SHALL be implemented ONLY as an explicitly-labeled ALIAS that compiles into the canonical flag (`--body` for the path-based passthrough tools; `--prompt`/`--input`/`--message`/`--thinking` etc. for the typed tools) — never as a silent replacement for the canonical flag, and never accepted in silent conflict with an explicit canonical flag setting the same value (THE SYSTEM SHALL reject that combination with a conflict error). Each command section in §2 that declares such an alias SHALL state the alias→canonical mapping explicitly, and BOTH the canonical flag form and every alias form (including the positional form) SHALL be required to produce an IDENTICAL request object, verified by tests covering both forms (Tier 1: pure `args/<command>.ts` mapping equivalence; Tier 2: mocked-SDK call-shape equivalence) per verification-architecture.md.

---

## 2. Per-command specifications

Each subcommand's flags mirror the source tool's zod `inputSchema` verbatim. File references point at the exact clone source read for this spec.

### 2.1 `wallet` (blockrun_wallet, src/tools/wallet.ts)

- REQ-101: `blockrun wallet [--action <status|deposit|setup|qr|chain|budget|delegate|revoke|report>]` — default `status`.
- REQ-102: `--chain <base|solana>` — target chain for `--action chain`; omit to just view current chain.
- REQ-103: `--budget-action <set|check|clear>`, `--budget-amount <number>` — for `--action budget`.
- REQ-104: `--agent-id <string>`, `--agent-limit <number>` — for `--action delegate` / `--action revoke` / `--action report`.
- REQ-105: `status` (default) SHALL show BOTH Base and Solana addresses + USDC balances + which chain is active (mirrors `wallet.ts:294-329`).
- REQ-106: `--action delegate` SHALL require `--agent-id` and a positive `--agent-limit`; `--action revoke` SHALL require `--agent-id`.
- REQ-107: All `wallet` actions are FREE (no x402 payment) — mirrors the tool having no `reserveBudget`/`recordSpending` calls anywhere in `wallet.ts`.
- REQ-107a: `--action budget/delegate/revoke/report` SHALL read from and write to the PERSISTED ledger at `~/.blockrun/cli-budget.json` (REQ-019/019a/019b), NOT an in-memory structure — a `report` invocation in a separate process from the `delegate` that created the allocation SHALL reflect it, since the file is the source of truth across invocations.

### 2.2 `chat` (blockrun_chat, src/tools/chat.ts)

- REQ-108: Canonical surface (mirrors `chat.ts` `inputSchema` exactly, per REQ-022): `--message <string>`.
- REQ-108a: Ergonomic ALIAS (per REQ-023): a bare positional argument, `blockrun chat <message>`, compiles into `--message`. WHEN both the positional AND `--message` are supplied, THE SYSTEM SHALL reject the invocation with a conflict error. `blockrun chat "hi"` and `blockrun chat --message "hi"` SHALL produce an IDENTICAL request — tested per REQ-023.
- REQ-109: `--model <string>` (e.g. `zai/glm-5`, `openai/o3`).
- REQ-110: `--mode <fast|balanced|powerful|cheap|reasoning|free|coding|glm>`.
- REQ-111: `--routing <smart>`.
- REQ-112: `--routing-profile <free|eco|auto|premium>` (default `auto`).
- REQ-113: `--system <string>`, `--max-tokens <number>` (default 1024), `--temperature <number>` (default 1), `--response-format <text|json_object>`, `--stop <string...>` (max 4 values).
- REQ-114: Canonical surface (mirrors `chat.ts` `inputSchema` exactly, per REQ-022): `--thinking <json>` (or `--thinking @file.json`, per REQ-004) — the literal `thinking` object, `{"type":"enabled","budget_tokens":<int, 1024–100000>}`, honored ONLY when `--model` matches `anthropic/claude-*` (`isAnthropicModel`).
- REQ-114a: Ergonomic ALIAS (per REQ-023): `--thinking-budget-tokens <int, 1024–100000>` compiles into the canonical `--thinking` object as `{"type":"enabled","budget_tokens":<value>}` — it is NOT a separate canonical field. WHEN both `--thinking` and `--thinking-budget-tokens` are supplied, THE SYSTEM SHALL reject the invocation with a conflict error (mirrors REQ-152a's/REQ-154a's conflict-rejection pattern) rather than silently preferring one. `blockrun chat --model anthropic/claude-opus-4.8 --thinking-budget-tokens 2000 ...` and `blockrun chat --model anthropic/claude-opus-4.8 --thinking '{"type":"enabled","budget_tokens":2000}' ...` SHALL produce an IDENTICAL request — tested per REQ-023.
- REQ-115: `--agent-id <string>`.
- REQ-116: `--messages <json>` (array of `{role, content}`; content may be a string or a multimodal array of text/image_url parts) for multi-turn; when set, `message` is appended as the final user turn.
- REQ-117: WHEN `--model` matches `anthropic/claude-*`, THE SYSTEM SHALL route natively (verbatim thinking blocks/signatures) — this path SHALL be Base-only (mirrors `baseOnlyMessage` guard in `chat.ts:177-181`); on Solana it SHALL fail with an actionable message, not silently fall back.
- REQ-118: WHEN `--routing smart`, THE SYSTEM SHALL reject combination with `--messages` (multi-turn) with a clear error (mirrors `chat.ts:204-209`), and SHALL fail with an actionable message on Solana (ClawRouter is Base-only, `chat.ts:210-215`).
- REQ-119: THE SYSTEM SHALL implement the tiered budget pre-check exactly as `estimateChatCost` (`chat.ts:22-79`): free for `mode=free` or `nvidia/*` models; frontier-reserve heuristics for `reasoning`/`powerful`/`balanced`/`coding` modes or any explicit model; cheap heuristic only for `cheap`/`fast`/`glm`.

### 2.3 `models` (blockrun_models, src/tools/models.ts)

- REQ-120: `blockrun models [--category <all|chat|reasoning|image|embedding>] [--provider <string>]` — defaults `category=all`.
- REQ-121: FREE — no payment.
- REQ-122: Output lists each model's id, pricing (input/output $/M tokens for LLMs, $/image for image models), context window, categories, matching `models.ts:43-58` formatting.

### 2.4 `image` (blockrun_image, src/tools/image.ts)

- REQ-123: Canonical surface (mirrors `image.ts` `inputSchema` exactly, per REQ-022): `blockrun image --prompt <string> [--action <generate|edit>] [--model <enum>] [--image <path|url|dataURI>...] [--mask <path|url|dataURI>] [--size <string>] [--quality <standard|hd>] [--inline] [--agent-id <string>]` (`agent_id` is a canonical field per `image.ts` `inputSchema`).
- REQ-123a: Ergonomic ALIAS (per REQ-023): a bare positional argument, `blockrun image <prompt> [flags...]`, compiles into `--prompt`. WHEN both the positional AND `--prompt` are supplied, THE SYSTEM SHALL reject the invocation with a conflict error. Both forms SHALL be tested per REQ-023.
- REQ-124: `--model` enum: `zai/cogview-4`, `google/nano-banana`, `google/nano-banana-pro`, `openai/gpt-image-1`, `openai/gpt-image-2` (default), `xai/grok-imagine-image`, `xai/grok-imagine-image-pro`.
- REQ-125: `--size` default `1024x1024`; `--quality` default `standard`.
- REQ-126: `--action edit` SHALL require `--image`; SHALL reject models not in the edit-capable set (`openai/gpt-image-1`, `openai/gpt-image-2`, `google/nano-banana`, `google/nano-banana-pro`); SHALL enforce the max-source-image count per provider prefix (openai/* ≤4, google/* ≤3); SHALL reject `--mask` combined with >1 source image; SHALL reject `--mask` on non-OpenAI models.
- REQ-127: `--image`/`--mask` values SHALL accept a base64 data URI, an http(s) URL (fetched, SSRF-guarded against private/loopback/link-local hosts, size-capped at 4MB, 30s timeout, ≤5 redirect hops), or a local file path (png/jpg/jpeg/gif/webp only, 4MB cap) — auto-converted to a data URI before the SDK call, mirroring `image.ts:34-90`.
- REQ-128: Cost estimation SHALL mirror `estimateCost()` (`image.ts:149-155`): per-model base price from `GENERATE_MODEL_COST`, upgraded to `LARGE_SIZE_COST` only when a dimension genuinely exceeds 1024px.
- REQ-129: Output SHALL be a materialized file path or URL (data-URI responses SHALL be written to a local temp file, mirroring `materializeImageUrl`, `image.ts:168-176`), the prompt, model, and actual billed USD cost.

### 2.5 `video` (blockrun_video, src/tools/video.ts)

- REQ-130: Canonical surface (mirrors `video.ts` `inputSchema` exactly, per REQ-022): `blockrun video --prompt <string> [--image-url <url>] [--real-face-asset-id <ta_xxxx>] [--duration-seconds <1-60>] [--generate-audio] [--resolution <enum>] [--aspect-ratio <enum>] [--last-frame-url <url>] [--model <enum>] [--agent-id <string>] [--max-quote-usd <number>]` (`agent_id` is a canonical field per `video.ts` `inputSchema`; `--max-quote-usd` is a CLI-only safety flag, NOT a source field — see REQ-135a).
- REQ-130a: Ergonomic ALIAS (per REQ-023): a bare positional argument, `blockrun video <prompt> [flags...]`, compiles into `--prompt`. WHEN both the positional AND `--prompt` are supplied, THE SYSTEM SHALL reject the invocation with a conflict error. Both forms SHALL be tested per REQ-023.
- REQ-131: `--model` enum: `azure/sora-2`, `xai/grok-imagine-video` (default), `bytedance/seedance-1.5-pro`, `bytedance/seedance-2.0-fast`, `bytedance/seedance-2.0`.
- REQ-132: `--real-face-asset-id` and `--image-url` are mutually exclusive; `--real-face-asset-id` requires a Seedance-2.0-family model; `--last-frame-url` requires `--image-url` and is mutually exclusive with `--real-face-asset-id`. WHEN `--model azure/sora-2`, `--duration-seconds` is constrained to exactly `4`, `8`, or `12` (source: `video.ts:66` description text — "duration_seconds must be 4, 8, or 12"; this is a documented upstream constraint, not a zod-enforced enum in the source schema, so the CLI SHALL enforce it as a local pre-flight check for `azure/sora-2` specifically, returning a validation error before any network call for any other value). Per the REQ-013 `--help` precedent (surfacing tiered/fixed pricing notes), `video --help` SHALL print this `azure/sora-2`-specific duration constraint alongside the generic `--duration-seconds <1-60>` flag description so a caller does not discover it only via a rejected paid call.
- REQ-133: THE SYSTEM SHALL be Base-only — fail with an actionable chain-switch message when the active chain is Solana (mirrors `video.ts:93-98`).
- REQ-134: THE SYSTEM SHALL implement the full async submit→poll→settle flow: POST to get a 402 quote, sign via `createPaymentPayload`, submit with `PAYMENT-SIGNATURE`, poll the same URL every 5s up to a 300s total budget, and settle ONLY on the first `completed` poll — a failed/timed-out job SHALL NOT charge (mirrors `video.ts:163-334`).
- REQ-135: WHEN the real 402-quoted price exceeds the local per-second estimate, THE SYSTEM SHALL re-check the budget cap against the real quote BEFORE signing payment (mirrors `video.ts:183-196`). THE SYSTEM SHALL surface the exact quoted amount to the caller (human-readable and `--json`) BEFORE signing in every invocation, not only when a `--budget-limit` was passed — this is the quote-gate that verification-architecture.md §4.3 relies on to bound real-money risk without any blind-signing step.
- REQ-135a: THE SYSTEM SHALL support a `video`-specific `--max-quote-usd <number>` option (default: none set → no additional gate beyond REQ-135's budget re-check). WHEN `--max-quote-usd` IS set AND the 402-quoted amount exceeds it, THE SYSTEM SHALL abort BEFORE calling `createPaymentPayload()` (no signature is EVER produced for a quote over the cap), exit with a nonzero code, and emit the exact quoted amount in both the human-readable message and the `--json` error object. This is a non-interactive, deterministic, CLI-enforced gate — distinct from REQ-018's general per-invocation budget cap — specifically for the case where the caller wants a hard "never pay more than $X for this one video" ceiling without needing a pre-configured budget.
- REQ-136: Output SHALL include the hosted MP4 URL, actual duration, model, and actual billed USD; a `--json` failure on timeout SHALL state no payment was taken.

### 2.6 `realface` (blockrun_realface, src/tools/realface.ts)

- REQ-137: `blockrun realface --action <init|status|enroll|portrait|list> [--name <string, 1-64 chars>] [--group-id <legacy_rf_NNN>] [--image-url <url>] [--agent-id <string>]` (`agent_id` is a canonical field per `realface.ts` `inputSchema`, REQ-022; per the source description it is honored ONLY for `--action enroll` — passing it with `init`/`status`/`portrait`/`list` SHALL be accepted but has no budget-tracking effect, matching the source tool's own scoping). `--name` SHALL be validated with the same `z.string().min(1).max(64)` constraint as the source tool (`realface.ts:101`) — rejected locally (no network call) outside that length range. `--image-url` SHALL be validated as a generic `z.string().url()` (any scheme the URL parser accepts, not restricted to `https://`) — mirrors the source schema exactly (`realface.ts:103`: `z.string().url()`, no protocol restriction in the zod validator itself); the tool description's "public HTTPS URL" language is a usage convention for the caller, NOT a schema-enforced constraint, and this CLI SHALL NOT over-reject a syntactically valid `http://` URL that the source schema would accept.
- REQ-138: `init` (free) requires `--name` (1-64 chars, see REQ-137); renders/opens a QR for the phone liveness H5 link.
- REQ-139: `status` (free) requires `--group-id`; reports `ready_to_finalize`.
- REQ-140: `enroll` (paid, $0.01, Base-only) requires `--name`, `--image-url`, `--group-id`.
- REQ-141: `portrait` (paid, $0.01, Base-only) requires `--name`, `--image-url`; no liveness/group needed.
- REQ-142: `list` (free) lists both RealFace and Virtual Portrait assets for the active wallet.
- REQ-143: `enroll`/`portrait` SHALL use the manual x402 probe→sign→resubmit flow (mirrors `payAndPostJson`, `realface.ts:25-75`) and SHALL fail with an actionable chain-switch message off Base.

### 2.7 `music` (blockrun_music, src/tools/music.ts)

- REQ-144: Canonical surface (mirrors `music.ts` `inputSchema` exactly, per REQ-022): `blockrun music --prompt <string> [--instrumental] [--lyrics <string>] [--model <minimax/music-2.5+|minimax/music-2.5>] [--agent-id <string>]` — `--instrumental` defaults true; `agent_id` is a canonical field per `music.ts` `inputSchema`.
- REQ-144a: Ergonomic ALIAS (per REQ-023): a bare positional argument, `blockrun music <prompt> [flags...]`, compiles into `--prompt`. WHEN both the positional AND `--prompt` are supplied, THE SYSTEM SHALL reject the invocation with a conflict error. Both forms SHALL be tested per REQ-023.
- REQ-145: `--lyrics` SHALL be rejected when `--instrumental` is true.
- REQ-146: Base-only; async submit (inline 200 fast-path OR 202+poll slow-path up to 240s); settles only on completion or inline success; failure/timeout SHALL NOT charge. WHEN an `X-Payment-Receipt` header is present on the settling response but the parsed track `url` is missing from the response body, THE SYSTEM SHALL treat the spend as ALREADY SETTLED on-chain and record it (SHALL NOT silently drop the charge from the ledger just because the body was malformed/truncated) — mirrors `music.ts:190-196`'s `if (txHash) recordActualSpend(...)` guard before throwing "No track URL in response".
- REQ-147: Reported cost SHALL be the real 402-quoted amount (`amountToUsd(details.amount)`), falling back to the flat $0.1575 estimate only if unparseable.

### 2.8 `speech` (blockrun_speech, src/tools/speech.ts)

- REQ-148: Canonical surface (mirrors `speech.ts` `inputSchema` exactly, per REQ-022): `blockrun speech --input <string> [--action <speak|sound_effect|voices>] [--voice <alias|id>] [--model <enum>] [--response-format <mp3|opus|pcm|wav>] [--speed <0.7-1.2>] [--duration-seconds <0.5-22>] [--prompt-influence <0-1>] [--agent-id <string>]` — `--action` default `speak`, `--model` default `elevenlabs/flash-v2.5`, `--response-format` default `mp3`; `agent_id` is a canonical field per `speech.ts` `inputSchema`; `--input` is optional (per REQ-005) since `voices` needs none.
- REQ-148a: Ergonomic ALIAS (per REQ-023): a bare positional argument, `blockrun speech [<input>] [flags...]`, compiles into `--input`. WHEN both the positional AND `--input` are supplied, THE SYSTEM SHALL reject the invocation with a conflict error. Both forms SHALL be tested per REQ-023.
- REQ-149: `voices` action is FREE (falls back to built-in alias list on gateway failure, mirrors `speech.ts:280-308`).
- REQ-150: `speak`/`sound_effect` require `<input>`; `sound_effect` caps input at 1000 chars; `speak` caps input per-model (`SPEECH_MODELS` max chars table, `speech.ts:34-39`).
- REQ-151: Base-only; cost = `speechCost()` (chars/1000 × per-model rate × 1.05 margin, min $0.001) for `speak`, flat $0.0525 for `sound_effect`; actual billed cost SHALL come from the 402 quote.

### 2.9 `search` (blockrun_search, src/tools/search.ts)

- REQ-152: Canonical surface (mirrors `search.ts` `inputSchema` exactly, per REQ-022): `blockrun search --body <json> [--path <string>] [--agent-id <string>]` — `path` is the sub-path under `/v1/search/` and defaults to `""` (root); `body` is the JSON request body (minimum `{"query": "..."}`); `agent_id` is optional.
- REQ-152a: Ergonomic ALIASES (compile into `--body`, per REQ-023) — documented body-shape convention from the tool description, NOT separate canonical fields: `--query <string>` → `body.query`; `--sources <web,x,news>` (comma-separated, or the flag repeated) → `body.sources` (array); `--max-results <1-50>` → `body.max_results`; `--from-date <YYYY-MM-DD>` → `body.from_date`; `--to-date <YYYY-MM-DD>` → `body.to_date`. WHEN an alias flag and `--body` both set the same field, THE SYSTEM SHALL reject the invocation with a conflict error rather than silently picking one. `blockrun search --query foo --max-results 5` and `blockrun search --body '{"query":"foo","max_results":5}'` SHALL produce an IDENTICAL request body — tested per REQ-023.
- REQ-153: Cost = `$0.025 × max_results` (default max_results 10 → $0.25, computed from the EFFECTIVE body after alias resolution), per `estimateSearchCost` (`search.ts:28-33`).

### 2.10 `exa` (blockrun_exa, src/tools/exa.ts)

- REQ-154: Canonical surface (mirrors `exa.ts` `inputSchema` exactly, per REQ-022): `blockrun exa --path <search|answer|contents|find-similar> --body <json> [--agent-id <string>]`.
- REQ-154a: Ergonomic ALIASES (compile into `--body`, per REQ-023) — documented per-path body-shape conventions from the tool description, NOT separate canonical fields: for `--path search`: `--query <string>`→`body.query`, `--num-results <n>`→`body.numResults`, `--category <news|research paper|company|tweet|github|pdf>`→`body.category`, `--include-domains <csv>`→`body.includeDomains`, `--exclude-domains <csv>`→`body.excludeDomains`; for `--path answer`: `--query <string>`→`body.query`; for `--path contents`: `--urls <csv|repeated flag>`→`body.urls` (array, up to 100); for `--path find-similar`: `--url <string>`→`body.url`, `--num-results <n>`→`body.numResults`. Conflicting alias + `--body` for the same field SHALL be rejected (mirrors REQ-152a). Both the canonical `--body` form and every alias form SHALL be tested per REQ-023.
- REQ-155: Cost: `contents` = $0.002 × url count (min 1, counted from the EFFECTIVE body after alias resolution); all others = $0.01 flat, per `estimateExaCost` (`exa.ts:21-28`).

### 2.11 `markets` (blockrun_markets, src/tools/markets.ts)

- REQ-156: `blockrun markets --path <string> [--params <json>] [--body <json>] [--agent-id <string>]` (`agent_id` is a canonical field per `markets.ts` `inputSchema`, REQ-022).
- REQ-157: Cost: any `--body`-bearing (POST) call = $0.005; else $0.001 UNLESS the path contains `wallet`, `smart`, `matching-markets`, `markets/search`, or `binance/`, which are $0.005 — per `estimateMarketCost` (`markets.ts:11-24`).
- REQ-158: GET calls route through the SDK's `pm(path, params)`; POST calls route through `pmQuery(path, body)` (confirmed present on both `LLMClient` and `SolanaLLMClient` in the SDK).

### 2.12 `price` (blockrun_price, src/tools/price.ts)

- REQ-159: `blockrun price --action <price|history|list> --category <crypto|fx|commodity|usstock|stocks> [--symbol <string>] [--market <us|hk|jp|kr|gb|de|fr|nl|ie|lu|cn|ca>] [--session <pre|post|on>] [--resolution <1|5|15|60|240|D|W|M>] [--from <unix>] [--to <unix>] [--query <string>] [--limit <1-2000>] [--agent-id <string>]` (`agent_id` is a canonical field per `price.ts` `inputSchema`, REQ-022; NOTE `--query`/`--limit` here are ALREADY canonical `price.ts` field names for `action=list`, not aliases — unlike `search`/`exa`'s convenience flags).
- REQ-160: `--category stocks` SHALL require `--market`.
- REQ-161: `crypto`/`fx`/`commodity` are FREE across all three actions; `stocks`/`usstock` price/history calls cost $0.001 and are Base-only (fail with actionable chain message on Solana, mirrors `price.ts:76-82`); `list` is always free.
- REQ-162: `price` action requires `--symbol`; `history` requires `--symbol` and `--from`.

### 2.13 `dex` (blockrun_dex, src/tools/dex.ts)

- REQ-163: `blockrun dex [--query <string>] [--token <address>] [--symbol <string>] [--chain <string>]` — at least one of `--query`/`--token`/`--symbol` required.
- REQ-164: FREE — direct call to DexScreener's public API, no wallet/x402 involved.
- REQ-165: Results filtered by `--chain` (substring match on `chainId`) and sorted by 24h volume descending, top 10.

### 2.14 `rpc` (blockrun_rpc, src/tools/rpc.ts)

- REQ-166: `blockrun rpc --network <string> [--method <string>] [--params <json>] [--body <json>] [--agent-id <string>]` (`agent_id` is a canonical field per `rpc.ts` `inputSchema`, REQ-022).
- REQ-167: Exactly one of `--method` (with optional `--params`) or `--body` (full JSON-RPC 2.0 object or array/batch) SHALL be provided; if neither, error.
- REQ-168: `--network` SHALL be validated as a well-formed chain slug (`[a-z0-9-]+`) before any network call; malformed slugs SHALL be rejected locally.
- REQ-169: Cost = $0.002 × batch element count (1 for a single non-array body).

### 2.15 `defi` (blockrun_defi, src/tools/defi.ts)

- REQ-170: `blockrun defi --path <string> [--agent-id <string>]` (GET only), e.g. `protocols`, `protocol/{slug}`, `chains`, `yields`, `prices/{coins}`; `agent_id` is a canonical field per `defi.ts` `inputSchema`, REQ-022.
- REQ-171: Cost = $0.001 if path starts with `prices`, else $0.005, per `estimateDefiCost` (`defi.ts:21-23`).

### 2.16 `modal` (blockrun_modal, src/tools/modal.ts)

- REQ-172: `blockrun modal --path <sandbox/create|sandbox/exec|sandbox/status|sandbox/terminate> --body <json> [--agent-id <string>]` (`agent_id` is a canonical field per `modal.ts` `inputSchema`, REQ-022).
- REQ-173: Cost = $0.01 if path includes `sandbox/create`, else $0.001, per `estimateModalCost` (`modal.ts:21-23`).
- REQ-174: THE SYSTEM SHALL size the outbound HTTP client timeout to cover a long-running `sandbox/exec` (default 300s, clamped [300s, 1800s] + 15s slack, per `modalTimeoutMs`, `modal.ts:34-39`), not the SDK's default 60s.

### 2.17 `phone` (blockrun_phone, src/tools/phone.ts)

- REQ-175: `blockrun phone --path <string> [--body <json>] [--agent-id <string>]` (`agent_id` is a canonical field per `phone.ts` `inputSchema`, REQ-022).
- REQ-176: Cost table (exact match on normalized path, per `estimatePhoneCost`, `phone.ts:25-35`): `voice/call/{id}` GET (no body) = free; `phone/numbers/release` = free; `phone/lookup` = $0.01; `phone/lookup/fraud` = $0.05; `phone/numbers/buy`/`renew` = $5.00; `phone/numbers/list` = $0.001; `voice/call` = $0.54; any other body-bearing call = $0.001; any other bodyless call = free.
- REQ-177: `voice/call` REQUIRES a `from` field in `--body` referencing a wallet-owned number (provisioned via `phone/numbers/buy` first).

### 2.18 `surf` (blockrun_surf, src/tools/surf.ts)

- REQ-178: `blockrun surf --path <string> [--params <json>] [--body <json>] [--agent-id <string>]` (`agent_id` is a canonical field per `surf.ts` `inputSchema`, REQ-022).
- REQ-179: Cost = tiered lookup against the EXACT path sets ported from `surf.ts:33-64`: Tier 3 ($0.02) = `{onchain/sql, onchain/query, onchain/schema, chat/completions}`; Tier 2 ($0.005) = the 19 exact paths listed in `SURF_T2_PATHS` (`surf.ts:41-61`: `exchange/depth`, `exchange/klines`, `exchange/funding-history`, `exchange/long-short-ratio`, `market/liquidation/exchange-list`, `market/liquidation/order`, `market/liquidation/chart`, `market/onchain-indicator`, `market/price-indicator`, `prediction-market/polymarket/positions`, `prediction-market/polymarket/activity`, `social/detail`, `social/ranking`, `social/smart-followers/history`, `social/mindshare`, `token/dex-trades`, `token/holders`, `token/transfers`, `web/fetch` — 19 entries, verified by count) PLUS any path prefixed `search/` or `wallet/`; Tier 1 ($0.001) = everything else (default).
- REQ-180: Path classification SHALL normalize (drop query string/fragment, strip leading/trailing slashes, lowercase) BEFORE the tier lookup, mirroring `normalizeClassifyPath` (`path-safety.ts:42-48`), so a query string or trailing slash cannot downgrade a Tier 2/3 path to the Tier 1 default.
- REQ-181: A `--body` presence routes the call as POST (`requestWithPaymentRaw`); its absence routes as GET (`getWithPaymentRaw`) with `--params`.

---

## 3. Path-traversal / input safety (cross-cutting)

- REQ-200: For every path-based passthrough command (`surf`, `defi`, `exa`, `markets`, `modal`, `phone`, `search`, `rpc`), THE SYSTEM SHALL reject a `--path`/`--network` value containing a `.` or `..` path segment (after a single `decodeURIComponent` pass and splitting on both `/` and `\`), mirroring `hasPathTraversal()` (`path-safety.ts:24-28`), BEFORE any cost estimation or network call.
- REQ-201: For `rpc`, THE SYSTEM SHALL additionally reject any `--network` value that is not `^[a-z0-9-]+$` after trim/lowercase/leading-trailing-slash-strip, mirroring `isValidNetworkSlug()` (`path-safety.ts:55-57`).

## 4. Error classification (cross-cutting)

- REQ-210: THE SYSTEM SHALL classify every command failure into one of: payment/balance error (HTTP 402, "insufficient", "balance", "rejected"), model-unavailable error ("not active for requested provider", "not found or not active"), server error (HTTP 500, "API error after payment"), or generic error — mirroring `formatError()`'s classification (`errors.ts:57-103`) — and SHALL append the SAME actionable next-step guidance text class for class (fund-wallet instructions with the correct chain name for payment errors; "try a different model" for model-unavailable; "try again in a few minutes" for server errors).
- REQ-211: WHEN an underlying SDK error carries a structured response body (`message`/`hint`/`missing_params`), THE SYSTEM SHALL surface those fields in the error text, mirroring `extractErrorMessage()` (`errors.ts:9-34`).

## 5. Payment / budget cross-cutting rules

- REQ-220: For every command whose cost is knowable only after a 402 quote (`video`, `music`, `speech`, `realface enroll/portrait`, Solana `image`), THE SYSTEM SHALL re-validate the real quoted amount against the per-invocation cap (REQ-018) AND the persisted global/per-agent cap (REQ-019c) BEFORE signing the payment payload, and SHALL abort with no charge if either would be exceeded — mirroring `reReserveIfHigher()` (`budget.ts:101-113`). For `video` specifically, THE SYSTEM SHALL additionally check `--max-quote-usd` if set (REQ-135a) — a THIRD, independent gate.
- REQ-221: THE SYSTEM SHALL NEVER construct an x402 payment payload, EIP-712 signature, or wallet key management itself — every payment signature SHALL be produced by calling `createPaymentPayload()` from `@blockrun/llm`, and every wallet key SHALL be obtained via `getOrCreateWallet()` / `getOrCreateSolanaWallet()` / `loadSolanaWallet()` from `@blockrun/llm`.
- REQ-222: THE SYSTEM SHALL access `LLMClient`/`SolanaLLMClient`'s `requestWithPaymentRaw()` and `getWithPaymentRaw()` methods via the SAME structural-type cast pattern already used in `blockrun-mcp` (e.g. `getClient() as unknown as { getWithPaymentRaw: ...; requestWithPaymentRaw: ... }`, mirrored across `surf.ts:22-25`, `exa.ts:16-19`, `defi.ts:16-18`, `modal.ts:16-19`, `phone.ts:17-20`, `search.ts:17-20`, `rpc.ts:19-21`), because the SDK's public `.d.ts` declares these methods `private` on the class (confirmed: `dist/index.d.ts:1242,1251` for `LLMClient`, `:2939,2941` for `SolanaLLMClient`) even though the compiled JS exposes them at runtime. This is NOT reimplementing signing — it is calling the SDK's own (structurally-typed) method.

---

## 6. Traceability

Every REQ-1xx section states its `src/tools/*.ts` source file inline for the adversary/verifier to cross-check against the same clone path this spec was written from. `estimate*Cost` pure functions named in section 2 are the ports the verification architecture (Phase 1b) assigns to Tier 1 (pure unit tests).

### 6.1 Positional-vs-canonical audit (spec-review v4)

Every one of the 18 commands was re-checked for a positional-argument-only canonical field (a gap the spec-review adversary found in `image`/`video`/`music`/`speech`, fixed at REQ-123/123a, REQ-130/130a, REQ-144/144a, REQ-148/148a; `chat` already had both forms but lacked the explicit alias/conflict framing, fixed at REQ-108/108a). Confirmed clean (canonical field is ALREADY a named flag, no positional shorthand exists to formalize): `wallet` (no scalar "main" argument — action-based), `models` (no required scalar), `dex` (`--query`/`--token`/`--symbol`, REQ-163 — no positional), `price` (`--symbol` etc., REQ-159 — no positional), `rpc` (`--network`, REQ-166 — no positional), `markets`/`defi`/`modal`/`phone`/`surf` (`--path`, REQ-156/170/172/175/178 — no positional), `search`/`exa` (`--body`/`--path`, REQ-152/154 — no positional; their aliases are body-shape conventions, not positional args), `realface` (`--action`-gated fields, no single scalar "main" argument).
