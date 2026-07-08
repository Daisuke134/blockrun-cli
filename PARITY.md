# PARITY.md — blockrun-cli ↔ blockrun-mcp apple-to-apple evidence

This file maps all 18 `blockrun-cli` commands to their corresponding `blockrun-mcp` MCP tool, states
the parameter-mapping rule, and records verification evidence per Dais's Claude-Code-centric
apple-to-apple instruction: the primary verifier is Claude Code itself, driving both the CLI (Bash)
and the connected `mcp__blockrun__blockrun_*` MCP tools.

Every command is assigned to exactly one of two verification tiers:

- **DUAL-LIVE-RUN** (9 commands: `wallet`, `chat`, `models`, `dex`, `price`, `defi`, `markets`, `rpc`,
  `phone`) — cheap enough ($0–$0.002/call) to invoke live through both the MCP tool and the CLI with
  the same input and compare real outputs side-by-side.
- **SCHEMA-ONLY** (9 commands: `image`, `video`, `music`, `realface`, `modal`, `speech`, `search`,
  `exa`, `surf`) — expensive/variable-cost enough that this feature does NOT re-execute them against
  the MCP side; evidence is (a) a static parameter-schema cross-check between the connected MCP tool's
  declared parameters and the CLI's `src/args/<command>.ts` schema, plus (b) the CLI-side real
  -execution evidence already in `VERIFICATION.md` (and, for `image`/`video`/`music`, the fresh
  full-URL re-run evidence under `.vcsdd/features/blockrun-cli-docs/evidence/`).

## Known non-parity points (intentional, by design)

- **`--budget-limit`** — a per-invocation ephemeral budget cap, present on every CLI command. This has
  no MCP-tool equivalent; `blockrun-mcp`'s budget state is in-memory per server session, while this
  CLI additionally persists a cross-process ledger to `~/.blockrun/cli-budget.json` (read/written by
  `wallet --action budget/delegate/revoke/report`). CLI-only by design (decisions.md §8-9).
- **`video --max-quote-usd`** — a CLI-only safety flag: abort BEFORE any payment signature is produced
  if the real 402-quoted price exceeds a caller-set cap. No MCP-tool equivalent (decisions.md §11).
- **Tool *profiles*** (`blockrun-mcp`'s `media`/`trading`/`research`/`chat` — 4 named subsets of the 18
  tools loaded via `--profile <name>`) are explicitly out of scope for this CLI (REQ-NG-006 of the
  CLI's own behavioral-spec.md) — the CLI always exposes all 18 commands; there is no `--profile` flag
  and no partial-command-set install.

## Commands

### wallet

- **MCP tool:** `blockrun_wallet`
- **CLI command:** `blockrun wallet`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `action` (status/deposit/setup/qr/chain/budget/delegate/revoke/report) →
  `--action`; `chain` → `--chain`; `budget_action` → `--budget-action`; `budget_amount` →
  `--budget-amount`; `agent_id` → `--agent-id`; `agent_limit` → `--agent-limit`. Additive CLI-only:
  `--budget-limit` (see non-parity points above). `report`/`delegate`/`revoke` read/write the SAME
  persisted ledger (`~/.blockrun/cli-budget.json`) across processes — a CLI-specific adaptation of the
  MCP server's in-memory budget state (VERIFICATION.md row #1 proves this cross-process).
- **Dual-run evidence (`action:"status"`, real call, 2026-07-08):** STRUCTURAL DIFFERENCE, confirmed —
  MCP flattens the ACTIVE chain's `address`/`balance` to top-level fields and adds `network`,
  `chainId`, `isNew`, `explorerUrl`, `explorerLabel`, plus a nested `wallets:{base,solana}` object:
  `{"activeChain":"solana","address":"8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9","balance":0,"network":"Solana","chainId":null,"isNew":false,"explorerUrl":"https://solscan.io/account/8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9","explorerLabel":"Solscan","wallets":{"base":{"address":"0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e","balance":0},"solana":{"address":"8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9","balance":0}}}`.
  The CLI instead exposes `base`/`solana` as top-level keys with no extra metadata:
  `{"activeChain":"base","base":{"address":"0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804","balance":0.264748},"solana":{"address":"HxeDzzgrMjZFnqqrEj6iZyiqx3XbeQ2Ke4ZcgdSshLZm","balance":0}}`.
  Both represent the SAME underlying `@blockrun/llm` wallet data — this is each side's own independent
  rendering code, not a functional gap. Free ($0), no funding needed.

### chat

- **MCP tool:** `blockrun_chat`
- **CLI command:** `blockrun chat`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `message` → `--message` (+ bare positional alias); `model` → `--model`; `mode`
  → `--mode`; `routing` → `--routing`; `routing_profile` → `--routing-profile`; `system` → `--system`;
  `max_tokens` → `--max-tokens`; `temperature` → `--temperature`; `response_format` →
  `--response-format`; `stop` → `--stop`; `thinking` → `--thinking` (+ `--thinking-budget-tokens`
  alias); `messages` → `--messages`; `agent_id` → `--agent-id`. 1:1 field-name parity.
- **Dual-run evidence (`message:"what is 2+2? reply with only the number"`, `mode:"free"`, real call,
  2026-07-08):** IDENTICAL field set `{model_used, response}` on both sides. MCP:
  `{"model_used":"nvidia/deepseek-v4-flash","response":"4"}`. CLI (matches `VERIFICATION.md` row #5's
  own captured shape, which used a different free model that happened to be auto-picked that run):
  `{"model_used":"nvidia/llama-4-maverick","response":"4"}`. Only the `model_used` VALUE differs (the
  free tier auto-picks whichever NVIDIA model is currently healthy) — structurally identical. Free
  ($0), no funding needed.

### models

- **MCP tool:** `blockrun_models`
- **CLI command:** `blockrun models`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `category` → `--category`; `provider` → `--provider`. 1:1 field-name parity
  on input; OUTPUT shape differs (see finding below).
- **Dual-run evidence (`category:"chat"`, real call, 2026-07-08):** TWO real, confirmed findings — (a)
  field-naming: MCP returns snake_case with a nested pricing object per model (`owned_by`,
  `context_window`, `max_output`, `billing_mode`, `pricing:{input,output}`, plus MCP-only `object`/
  `created`); CLI returns camelCase with flat pricing (`provider`, `contextWindow`, `maxOutput`,
  `billingMode`, `inputPrice`/`outputPrice`, plus CLI-only `available`/`type`). (b) COUNT MISMATCH: MCP
  returned `{"count":44,...}` models for `category:"chat"`; the CLI returned `{"count":55,...}` for the
  identical `--category chat` filter. This is recorded HONESTLY as a real discrepancy for the CLI
  feature owner to triage — root-causing it is out of scope for this docs feature (`src/` is read-only
  per REQ-NG-001; this file only documents facts, per DOC-CONSTRAINT-002's no-lies rule). Free ($0), no
  funding needed.

### dex

- **MCP tool:** `blockrun_dex`
- **CLI command:** `blockrun dex`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `query` → `--query`; `token` → `--token`; `symbol` → `--symbol`; `chain` →
  `--chain`. 1:1 field-name parity, no `agent_id` (dex has none in either surface — free, no wallet
  involved).
- **Dual-run evidence (`query:"SOL"`, real call, 2026-07-08):** BYTE-IDENTICAL output on both surfaces
  — both proxy the same DexScreener public API directly with no wallet/formatting divergence. This is
  the baseline case: a pure-passthrough command shows zero structural difference. Free ($0), no
  funding needed.

### price

- **MCP tool:** `blockrun_price`
- **CLI command:** `blockrun price`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `action` → `--action`; `category` → `--category`; `symbol` → `--symbol`;
  `market` → `--market`; `session` → `--session`; `resolution` → `--resolution`; `from` → `--from`;
  `to` → `--to`; `query` → `--query`; `limit` → `--limit`; `agent_id` → `--agent-id`. 1:1 field-name
  parity.
- **Dual-run evidence (`action:"price"`, `category:"crypto"`, `symbol:"BTC-USD"`, real call,
  2026-07-08):** IDENTICAL field set on both surfaces: `symbol, price, publishTime, confidence,
  feedId, timestamp, assetType, category, source, free` — including the SAME `feedId`
  (`0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`). Only the live `price`/
  `publishTime` values differ (calls made a few seconds apart on the same Pyth feed) — expected, not a
  finding. Free ($0, crypto/fx/commodity), no funding needed.

### defi

- **MCP tool:** `blockrun_defi`
- **CLI command:** `blockrun defi`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `path` → `--path`; `agent_id` → `--agent-id`. 1:1 field-name parity — both
  surfaces are a pure GET passthrough to `/v1/defillama/*`.
- **Dual-run evidence:** PENDING — Phase 3/4. This is a PAID call ($0.001-$0.005) on the MCP-connected
  wallet; a live check on 2026-07-08 found that wallet's balance at $0 on both Base
  (`0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e`) and Solana
  (`8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9`) — insufficient to execute this comparison right now.
  CLI-side evidence already exists at `VERIFICATION.md` row #6 (`--path
  prices/coingecko:bitcoin`, real result `{"coins":{"coingecko:bitcoin":{"price":63889.65,...}}}`,
  $0.001). This cell will be filled with a real dual-invocation once the MCP wallet is funded (or a
  schema-only fallback is recorded per DOC-PARITY-005a) — not fabricated here.

### markets

- **MCP tool:** `blockrun_markets`
- **CLI command:** `blockrun markets`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `path` → `--path`; `params` → `--params`; `body` → `--body`; `agent_id` →
  `--agent-id`. 1:1 field-name parity — both surfaces route GET-without-body through `pm(path,
  params)` and POST-with-body through `pmQuery(path, body)`.
- **Dual-run evidence:** PENDING — Phase 3/4 (same funding precondition as `defi` above — this
  wallet's balance is $0 as of the 2026-07-08 check). CLI-side evidence already exists at
  `VERIFICATION.md` row #8 (`--path polymarket/events`, real live Polymarket events, $0.001).

### rpc

- **MCP tool:** `blockrun_rpc`
- **CLI command:** `blockrun rpc`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `network` → `--network`; `method` → `--method`; `params` → `--params`; `body`
  → `--body`; `agent_id` → `--agent-id`. 1:1 field-name parity — both validate `network` as a
  well-formed chain slug before any network call.
- **Dual-run evidence:** PENDING — Phase 3/4 (same funding precondition — $0 balance as of
  2026-07-08). CLI-side evidence already exists at `VERIFICATION.md` row #9 (`--network base --method
  eth_blockNumber`, real result `{"id":1,"jsonrpc":"2.0","result":"0x2e16c6b"}`, $0.002).

### phone

- **MCP tool:** `blockrun_phone`
- **CLI command:** `blockrun phone`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `path` → `--path`; `body` → `--body`; `agent_id` → `--agent-id`. 1:1
  field-name parity — both route a body-bearing call as POST and a bodyless call as a free GET poll.
- **Dual-run evidence:** PENDING — Phase 3/4, cheapest sub-path only (`phone/numbers/list`, $0.001 —
  the $5/$0.54 sub-paths are NOT part of this comparison). Same funding precondition as `defi`/
  `markets`/`rpc` above. CLI-side evidence already exists at `VERIFICATION.md` row #18 (`--path
  phone/numbers/list --body '{}'`, real result `{"numbers":[],"count":0}`, $0.001).

### image

- **MCP tool:** `blockrun_image`
- **CLI command:** `blockrun image`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `action` → `action`; `agent_id` →
  `agent_id`; `image` → `image`; `inline` → `inline`; `mask` → `mask`; `model` → `model`; `prompt` →
  `prompt` (+ bare positional alias); `quality` → `quality`; `size` → `size`. Every MCP-declared
  parameter has a named CLI-flag counterpart — 1:1 parity, no CLI-only additions beyond the universal
  `--budget-limit`.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP to avoid double
  spend):** row #13 — `--model zai/cogview-4 --prompt "a red cube..."`, real 1024×1024 PNG, MD5
  `dc8a4cad2060539d2cb33392082031c3`, $0.015. Full non-truncated URL + fresh evidence record: see
  `.vcsdd/features/blockrun-cli-docs/evidence/` (DOC-EVID-001..005, Phase 3/4).

### video

- **MCP tool:** `blockrun_video`
- **CLI command:** `blockrun video`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`;
  `aspect_ratio` → `aspect_ratio`; `duration_seconds` → `duration_seconds`; `generate_audio` →
  `generate_audio`; `image_url` → `image_url`; `last_frame_url` → `last_frame_url`; `model` → `model`;
  `prompt` → `prompt` (+ bare positional alias); `real_face_asset_id` → `real_face_asset_id`;
  `resolution` → `resolution`. Every MCP-declared parameter has a named CLI-flag counterpart. CLI-only
  addition: `--max-quote-usd` (see non-parity points above).
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #16 —
  `--model xai/grok-imagine-video --duration-seconds 1 --resolution 360p --max-quote-usd 0.10`, real
  1s MP4, quote $0.0525 ≤ cap → signed, tx
  `0xa4625b8102c223d7733bf3d1a92a95769da7eb87d7992df5b6ef48d28f256c42`, $0.0525; plus row #16b's
  no-charge quote-gate abort proof. Full non-truncated URL + fresh evidence record: see
  `.vcsdd/features/blockrun-cli-docs/evidence/` (DOC-EVID-001..005, Phase 3/4).

### music

- **MCP tool:** `blockrun_music`
- **CLI command:** `blockrun music`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`;
  `instrumental` → `instrumental` (CLI: `--no-instrumental` flag negates the true default); `lyrics` →
  `lyrics`; `model` → `model`; `prompt` → `prompt` (+ bare positional alias). Every MCP-declared
  parameter has a named CLI-flag counterpart — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #15 —
  default model, `"chill lo-fi beats"`, 84s track, tx
  `0xaf974e98fe8183a311c7a37ad68a08cf701ecee727498c4351dd301115e5eeac`, $0.1575. Full non-truncated URL
  + fresh evidence record: see `.vcsdd/features/blockrun-cli-docs/evidence/` (DOC-EVID-001..005, Phase
  3/4).

### realface

- **MCP tool:** `blockrun_realface`
- **CLI command:** `blockrun realface`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `action` → `action`; `agent_id` →
  `agent_id`; `group_id` → `group_id`; `image_url` → `image_url`; `name` → `name`. Every MCP-declared
  parameter has a named CLI-flag counterpart — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #17 —
  `init`/`status`/`list` (free) → `portrait` with an AI-generated face, asset
  `ta_c97289c307c2430f8c3e5e1c75694c05`, group `legacy_rf_17921`, $0.01 (a first attempt hit a
  transient upstream 502 and correctly charged nothing; a retry settled — recorded honestly in
  `VERIFICATION.md`, not hidden). `enroll` (requires live human liveness) is untested-by-design per
  `VERIFICATION.md`'s own §4.4 note.

### modal

- **MCP tool:** `blockrun_modal`
- **CLI command:** `blockrun modal`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`; `body` →
  `body`; `path` → `path`. Every MCP-declared parameter has a named CLI-flag counterpart — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #12 —
  full lifecycle `sandbox/create` → `status` → `terminate`, sandbox `sb-C1EZrJXCKY2X40cDw9PGeu`:
  running → terminated, ≈$0.012.

### speech

- **MCP tool:** `blockrun_speech`
- **CLI command:** `blockrun speech`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `action` → `action`; `agent_id` →
  `agent_id`; `duration_seconds` → `duration_seconds`; `input` → `input` (+ bare positional alias);
  `model` → `model`; `prompt_influence` → `prompt_influence`; `response_format` → `response_format`;
  `speed` → `speed`; `voice` → `voice`. Every MCP-declared parameter has a named CLI-flag counterpart
  — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #14 —
  `--action speak --input "hi"`, MP3, tx
  `0xd8184055ef5999b21dd5ea33209396d5726d6e50bc45fea273267ed56b285815`, $0.001.

### search

- **MCP tool:** `blockrun_search`
- **CLI command:** `blockrun search`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`; `body` →
  `body` (+ ergonomic alias flags `--query`, `--sources`, `--max-results`, `--from-date`, `--to-date`
  that compile into `body`); `path` → `path`. Every MCP-declared parameter has a named CLI-flag
  counterpart — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #11 —
  `--query "blockrun ai gateway" --max-results 1`, real Grok live-search summary, $0.025.

### exa

- **MCP tool:** `blockrun_exa`
- **CLI command:** `blockrun exa`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`; `body` →
  `body` (+ per-path ergonomic alias flags `--query`, `--num-results`, `--category`,
  `--include-domains`, `--exclude-domains`, `--urls`, `--url`); `path` → `path`. Every MCP-declared
  parameter has a named CLI-flag counterpart — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #10 —
  `--path contents --body '{"urls":["https://blockrun.ai"]}'`, requestId
  `518dbb4e05447dd00b85a8beac638f45`, real page text, $0.002.

### surf

- **MCP tool:** `blockrun_surf`
- **CLI command:** `blockrun surf`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`; `body` →
  `body`; `params` → `params`; `path` → `path`. Every MCP-declared parameter has a named CLI-flag
  counterpart — 1:1 parity. Both surfaces normalize `--path`/`path` before tier classification
  (query-string/trailing-slash cannot downgrade a Tier-2/3 endpoint).
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #7 —
  `--path market/price --params '{"symbol":"BTC"}'`, real asksurf `MarketPriceResponse`, $0.001.
