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
- **Dual-run evidence (`category:"chat"`, real calls, 2026-07-08):** TWO measurements, taken hours
  apart, gave DIFFERENT results — recorded honestly, not smoothed over:
  - **First measurement:** MCP returned snake_case with a nested pricing object per model (`owned_by`,
    `context_window`, `max_output`, `billing_mode`, `pricing:{input,output}`, plus MCP-only `object`/
    `created`) and `count:44`. CLI returned camelCase with flat pricing (`provider`, `contextWindow`,
    `maxOutput`, `billingMode`, `inputPrice`/`outputPrice`, plus CLI-only `available`/`type`) and
    `count:55`.
  - **Second measurement (2026-07-08, later re-run, independently confirmed by BOTH the orchestrator
    and this docs-feature session):** MCP's response shape had CHANGED — it now returns the SAME
    camelCase, flat-pricing shape as the CLI (`inputPrice`/`outputPrice`/`contextWindow`/`maxOutput`/
    `billingMode`/`available`/`type`, top-level `{count, models}`), `count:55` on BOTH surfaces, and an
    IDENTICAL first model entry (`openai/gpt-5.5`, every field byte-for-byte equal).
  - **Conclusion, stated plainly:** this is not a stable CLI-vs-MCP structural difference — it is the
    live `blockrun_models` MCP tool's OWN response shape changing between calls (evidently a
    server-side change on BlockRun's end between the two measurement times, not a client-side
    difference this CLI introduces). At the time of the second measurement there is ZERO parity gap on
    this command. The first measurement's finding is retained above as an honest record of what was
    observed, not deleted — but is not evidence of an ongoing CLI defect. Free ($0), no funding needed.

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
- **Dual-run evidence (`path:"prices/coingecko:bitcoin"`, real call, 2026-07-08):** BYTE-IDENTICAL
  output on both surfaces (including live `price`/`timestamp` fields matching exactly, per the
  orchestrator's dual invocation). Executed after funding the MCP-connected wallet (DOC-PARITY-005a):
  `0x810f6d61f7606deee2657d3083e150a222bc29c5` sent $0.005 USDC to
  `0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e` (tx
  `0xe41ec6c19a46f0735ee17550ebf223bfb762e21ff6a090bcefe40af1b4cd1834`, recorded in
  `.vcsdd/features/blockrun-cli-docs/evidence/topup-mcp-1.json`) to cover this and the 3 other paid
  dual-live-run calls below. $0.001. CLI-side reference: `VERIFICATION.md` row #6.

### markets

- **MCP tool:** `blockrun_markets`
- **CLI command:** `blockrun markets`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `path` → `--path`; `params` → `--params`; `body` → `--body`; `agent_id` →
  `--agent-id`. 1:1 field-name parity — both surfaces route GET-without-body through `pm(path,
  params)` and POST-with-body through `pmQuery(path, body)`.
- **Dual-run evidence (`path:"polymarket/events"`, `limit=2`, real call, 2026-07-08):** Same structure
  and the same leading event (id `552326`) on both surfaces — funded from the same
  `topup-mcp-1.json` transfer as `defi` above. $0.001. CLI-side reference: `VERIFICATION.md` row #8.

### rpc

- **MCP tool:** `blockrun_rpc`
- **CLI command:** `blockrun rpc`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `network` → `--network`; `method` → `--method`; `params` → `--params`; `body`
  → `--body`; `agent_id` → `--agent-id`. 1:1 field-name parity — both validate `network` as a
  well-formed chain slug before any network call.
- **Dual-run evidence (`network:"base"`, `method:"eth_blockNumber"`, real call, 2026-07-08):**
  BYTE-IDENTICAL — both surfaces returned the SAME real Base block `0x2e1c3fe` — funded from the same
  `topup-mcp-1.json` transfer. $0.002. CLI-side reference: `VERIFICATION.md` row #9.

### phone

- **MCP tool:** `blockrun_phone`
- **CLI command:** `blockrun phone`
- **Tier:** DUAL-LIVE-RUN
- **Parameter mapping:** `path` → `--path`; `body` → `--body`; `agent_id` → `--agent-id`. 1:1
  field-name parity — both route a body-bearing call as POST and a bodyless call as a free GET poll.
- **Dual-run evidence (`path:"phone/numbers/list"`, `body:{}`, real call, 2026-07-08):**
  BYTE-IDENTICAL — both surfaces returned `{"numbers":[],"count":0}` (the cheapest sub-path only; the
  $5/$0.54 sub-paths are NOT part of this comparison) — funded from the same `topup-mcp-1.json`
  transfer. $0.001. CLI-side reference: `VERIFICATION.md` row #18.

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
  spend):** row #13 — original E2E run, `--model zai/cogview-4 --prompt "a red cube..."`, real
  1024×1024 PNG, MD5 `dc8a4cad2060539d2cb33392082031c3`, $0.015 (original URL recorded truncated and
  unrecoverable — see `VERIFICATION.md`'s fresh-media appendix).
- **Fresh full-URL evidence (DOC-EVID-001..005, 2026-07-08):** `--model zai/cogview-4 --prompt "a red
  cube on a white background"` → full URL
  `https://blockrun.ai/api/media/media/images/2026/07/08/4c8b9423-36ff-4ee3-a0b9-316e8f2a0c1a.png`,
  HTTP 200, MD5 `53a632611b24c2daa96c3b006bb6a862`, 30149 bytes, `cost_usd` 0.015 cross-checked against
  the `cli-budget.json` spend delta (no `txHash` in `image`'s output by design — confirmed at
  `src/commands/image.ts:83-84`). Full record + local artifact:
  `.vcsdd/features/blockrun-cli-docs/evidence/image.json` /
  `.vcsdd/features/blockrun-cli-docs/evidence/image-fresh.png`.

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
  original E2E run, `--model xai/grok-imagine-video --duration-seconds 1 --resolution 360p
  --max-quote-usd 0.10`, real 1s MP4, quote $0.0525 ≤ cap → signed, tx
  `0xa4625b8102c223d7733bf3d1a92a95769da7eb87d7992df5b6ef48d28f256c42`, $0.0525; plus row #16b's
  no-charge quote-gate abort proof (original URL recorded truncated and unrecoverable — see
  `VERIFICATION.md`'s fresh-media appendix).
- **Fresh full-URL evidence (DOC-EVID-001..005, 2026-07-08):** `--model xai/grok-imagine-video
  --prompt "a red cube rotating" --duration-seconds 1 --resolution 360p --max-quote-usd 0.10` → quote
  $0.052501 ≤ cap → signed → full URL
  `https://blockrun.ai/api/media/media/videos/2026/07/08/4edd85de-72c0-94e5-a443-c45a429d07d3-7f749dcc.mp4`,
  HTTP 200, MD5 `3785635d5f8140fe4eb632f9b053bc3f`, 122581 bytes, `cost_usd` 0.052501, `txHash`
  `0xac32089918ff53f3290c7e485f70f1d4e5929611dc28bf7f62fbd3ab080bccfe` (from the `X-Payment-Receipt`
  header, per `src/shell/manual-x402.ts`). Full record + local artifact:
  `.vcsdd/features/blockrun-cli-docs/evidence/video.json` /
  `.vcsdd/features/blockrun-cli-docs/evidence/video-fresh.mp4`.

### music

- **MCP tool:** `blockrun_music`
- **CLI command:** `blockrun music`
- **Tier:** SCHEMA-ONLY
- **Parameter mapping (MCP declared params → CLI schema field):** `agent_id` → `agent_id`;
  `instrumental` → `instrumental` (CLI: `--no-instrumental` flag negates the true default); `lyrics` →
  `lyrics`; `model` → `model`; `prompt` → `prompt` (+ bare positional alias). Every MCP-declared
  parameter has a named CLI-flag counterpart — 1:1 parity.
- **CLI-side live evidence (reused from `VERIFICATION.md`, NOT re-executed against MCP):** row #15 —
  original E2E run, default model, `"chill lo-fi beats"`, 84s track, tx
  `0xaf974e98fe8183a311c7a37ad68a08cf701ecee727498c4351dd301115e5eeac`, $0.1575 (original URL recorded
  truncated and unrecoverable — see `VERIFICATION.md`'s fresh-media appendix).
- **Fresh full-URL evidence (DOC-EVID-001..005, 2026-07-08):** `--prompt "chill lo-fi beats"` (default
  model `minimax/music-2.5+`) → 92s track, full URL
  `https://blockrun.ai/api/media/media/audios/2026/07/08/47eac713-dfd8-4969-9444-175ff7b39459.mp3`,
  HTTP 200, MD5 `2fc782959ce3d0279c053c0d0720cd86`, 2936520 bytes, `cost_usd` 0.1575, `txHash`
  `0xa00e6ef48ab067eb86da15911c98f78a1c508ac554e176a99191c7e02bea2784`. Full record + local artifact:
  `.vcsdd/features/blockrun-cli-docs/evidence/music.json` /
  `.vcsdd/features/blockrun-cli-docs/evidence/music-fresh.mp3`.

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
