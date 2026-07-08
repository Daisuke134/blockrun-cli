# blockrun-cli-docs — Behavioral Specification (EARS)

Feature: `blockrun-cli-docs` · Mode: lean · Language: TypeScript (docs-only, no source changes)

Grounding sources (read before writing this spec, all confirmed present on disk):
- Reference (model) repo: `blockrun-mcp` README.md / CONTRIBUTING.md / CHANGELOG.md / LICENSE / package.json at
  `/private/tmp/claude-501/-Users-anicca-anicca-project/ec3606df-8de7-491a-8a92-7ee667020d6a/scratchpad/blockrun-mcp/`
- CLI ground truth: `/Users/anicca/blockrun-cli/VERIFICATION.md` (18/18 live-API E2E ledger),
  `/Users/anicca/blockrun-cli/.vcsdd/features/blockrun-cli/specs/decisions.md` (Phase-2 engineering decisions),
  `/Users/anicca/blockrun-cli/.vcsdd/features/blockrun-cli/specs/behavioral-spec.md` (116-REQ CLI behavioral spec),
  live `node dist/index.js --help` / `node dist/index.js <cmd> --help` output (captured verbatim into this spec
  where quoted), `/Users/anicca/blockrun-cli/package.json` (current: version 0.1.0, no `repository`/`homepage` fields).

Every requirement is a MUST. There are no optional/recommended items in this document.

---

## 0. Scope

This feature produces **documentation and packaging artifacts only** for the already-complete
`blockrun-cli` (18 subcommands, 408 tests green, VCSDD `blockrun-cli` feature at phase `complete`,
18/18 live-API E2E evidence in `VERIFICATION.md`). The goal is external-reviewer readiness: a
3-person BlockRun team review must find the repo "apple-to-apple" with the reference `blockrun-mcp`
repo in structure and rigor, adapted from "MCP server" framing to "CLI" framing.

### Non-goals (REQ-NG-*)

- REQ-NG-001: This feature SHALL NOT modify any file under `src/` (docs-only; if a README example does
  not work against the real built binary, the DOC is fixed, never the source).
- REQ-NG-002: This feature SHALL NOT invent or document a CLI feature that does not exist in the built
  binary (e.g. tool *profiles* `media`/`trading`/`research`/`chat` — the CLI's own behavioral-spec.md
  REQ-NG-006 explicitly puts these out of scope; the docs SHALL NOT claim CLI profile support by
  mirroring blockrun-mcp's "Tool profiles" README section).
- REQ-NG-003: This feature SHALL NOT claim `npm publish` status — the CLI's own behavioral-spec.md
  REQ-NG-002 states npm publish is out of scope for the CLI feature itself; install instructions SHALL
  cover `npx`/clone+build against the GitHub repo, not an npm registry package, unless/until published.
- REQ-NG-004: This feature SHALL NOT write a "coming soon" / "planned" / unimplemented-feature claim
  anywhere in any produced doc.

---

## 1. README.md

- DOC-README-001: `/Users/anicca/blockrun-cli/README.md` SHALL exist and SHALL follow the same
  top-level section order as `blockrun-mcp/README.md`, adapted from MCP-server framing to CLI framing.
  The real order, VERIFIED directly via `grep -n '^#' blockrun-mcp/README.md`: `## Prerequisites`
  (line 78) → `## Install` (86) → `## Fund your wallet` (154) → `## Tools` (185) → `## Tips for
  effective LLMs` / `## Key Use Cases` / `## Why not just use the APIs directly?` / `## When NOT to
  use BlockRun MCP` (210-269) → `## Multi-agent budget delegation` (282) → `## Troubleshooting` (288)
  → `## Environment Variables` (306) → `## How it works` (339) → `## Contributing` (345). Note:
  Troubleshooting's own text links FORWARD to `[Environment Variables](#environment-variables)`,
  confirming Environment Variables comes AFTER Troubleshooting, not before. `blockrun-mcp/README.md`
  has NO separate `## License` heading (only a License badge in the title block linking to `LICENSE`,
  and a closing footer line) — this CLI's README MAY still end with a short License line/section as a
  CLI-appropriate addition (DOC-README-013), since that is standard CLI-repo practice, not because it
  mirrors an MCP-side heading that does not exist.

  THE SYSTEM'S required README order, translated to CLI framing: title + badges → one-line pitch →
  Prerequisites → Install → Fund your wallet → Commands table → usage examples (positionally
  corresponds to `blockrun-mcp`'s Tips/Key-Use-Cases block, adapted to a shorter CLI-appropriate form
  per DOC-README-007/008, not a verbatim port of those MCP-tool-call-shaped sections) → Multi-agent
  budget delegation → Troubleshooting → Environment Variables → How it works (x402) → Contributing →
  License.
- DOC-README-002: THE title/badge block SHALL include an MIT license badge (mirrors `blockrun-mcp`'s
  `[![License: MIT](...)](LICENSE)`) and MAY omit the npm-version badge unless/until the package is
  published to npm (REQ-NG-003).
- DOC-README-003: THE install section SHALL document BOTH: (a) running via a locally built clone
  (`git clone` → `npm install` → `npm run build` → `node dist/index.js <command>`, since `npm publish`
  is out of scope per REQ-NG-003), AND (b) the `npx`-equivalent form the package.json `bin` field makes
  possible once installed globally (`npm install -g .` then `blockrun <command>`), clearly labeled as
  local-install paths (not a published-registry `npx blockrun@latest` claim, which would violate
  REQ-NG-004 since the package is not published).
- DOC-README-003a (primary-reader framing, per Dais's instruction): THE README SHALL frame its PRIMARY
  reader as a **Claude Code user invoking this CLI from Claude Code's Bash tool** — the CLI-side
  equivalent of how `blockrun-mcp/README.md` frames ITS primary reader as someone registering the MCP
  server INTO Claude Code (`claude mcp add blockrun ...`). This CLI is NOT registered as an MCP server;
  instead, its README's install/usage sections SHALL show Claude Code (or any agent with shell access)
  invoking `blockrun <command>` directly via Bash, mirroring the SAME "agent gets pay-per-call data
  access" value proposition `blockrun-mcp`'s README leads with, adapted from "MCP tool call" framing to
  "shell command" framing. This is a POSITIONING requirement (how the README frames its audience), not
  a NEW technical requirement — it does not add or change any installed capability.
- DOC-README-004: THE prerequisites section SHALL state Node.js `>=20.19` (verbatim from
  `package.json` `engines.node`) and note the wallet auto-creates at `~/.blockrun/.session` on first
  use (mirrors `blockrun-mcp` README's Prerequisites section, ported 1:1 since both share the same
  `@blockrun/llm` wallet mechanism).
- DOC-README-005: THE fund-your-wallet section SHALL mirror `blockrun-mcp/README.md`'s "Fund your
  wallet" section content (Base default, Solana switch via `blockrun wallet --action chain --chain
  solana` then `--action setup`), rewritten as CLI invocations (`blockrun wallet ...`) instead of
  MCP tool calls (`blockrun_wallet action:"..."`).
- DOC-README-006: THE README SHALL contain a `## Commands` table with exactly 18 rows, one per
  subcommand, each row naming: the command (`blockrun <name>`), what it does (one line, drawn from
  that command's live `--help` description line), and its cost (drawn from the same `--help` line or
  `VERIFICATION.md`'s per-command cost column) — mirroring `blockrun-mcp/README.md`'s `## Tools` table
  shape (Tool / Data source / Cost columns) with "Tool" renamed "Command" and content sourced from the
  CLI, not copy-pasted from the MCP table.
- DOC-README-007: EVERY command example shown in the README (a `blockrun <cmd> ...` invocation) SHALL
  be executable verbatim against `node dist/index.js` using ONLY flags that appear in that command's
  real `--help` output — no invented flag, enum value, or default SHALL appear in any example.
- DOC-README-008: THE README SHALL include AT LEAST one `--json` example and AT LEAST one `--help`
  example, demonstrating both the machine-readable and human-readable output contracts (REQ-006/REQ-007
  of the CLI's own behavioral-spec.md).
- DOC-README-009: THE environment variables section SHALL list ONLY environment variables that are
  real per the CLI's `decisions.md`/`behavioral-spec.md`, rendered as exactly SIX separate table rows
  (one row per Variable/File member — `~/.blockrun/.chain` and `~/.blockrun/payment-chain` SHALL each
  get their OWN row, NOT be combined into a single row/cell via a `/` separator, so the rendered table
  has one row per distinct member PROP-006's set-equality check expects): `BLOCKRUN_BUDGET_LIMIT`
  (persisted-ledger seed, REQ-019a), `~/.blockrun/.session`, `~/.blockrun/.chain`,
  `~/.blockrun/payment-chain`, `~/.blockrun/.solana-session`, `SOLANA_WALLET_KEY` — mirroring
  `blockrun-mcp/README.md`'s "Environment Variables" table structure (Variable/File | Default | Effect
  columns) with the CLI's OWN variable set, not a verbatim copy of the MCP server's table.
  `BLOCKRUN_API_BASE_URL` (the test-only override from `decisions.md` §11) SHALL NOT appear (explicitly
  excluded from the CLI's own spec, REQ-017's sibling constraint applied via decisions.md §11: "NOT
  documented in the CLI's README as a supported override").
- DOC-README-010: THE multi-agent budget delegation section SHALL document BOTH layers the CLI
  actually implements: (a) the per-invocation ephemeral `--budget-limit` flag (REQ-018), and (b) the
  persisted cross-process ledger at `~/.blockrun/cli-budget.json` written by `blockrun wallet --action
  delegate/revoke/report` (REQ-019/REQ-107a) — this is a CLI-specific mechanism (the MCP server's
  budget state is in-memory per session, decisions.md §9) and SHALL be described as such, not presented
  as identical to the MCP server's delegation model.
- DOC-README-011: THE troubleshooting section SHALL cover at minimum: insufficient balance / HTTP 402,
  wrong active chain, and a malformed `--path`/`--network` value being rejected locally (REQ-200/201) —
  drawn from the CLI's real error-classification behavior (behavioral-spec.md §4), not copied verbatim
  from `blockrun-mcp`'s MCP-client-specific troubleshooting entries (e.g. Claude Code PATH/`spawn npx
  ENOENT` issues do not apply to a directly-invoked CLI binary and SHALL NOT be included).
- DOC-README-012: THE "how it works" section SHALL state the x402 USDC-on-Base(/Solana) payment
  mechanism (mirrors `blockrun-mcp/README.md`'s "How it works" section, same underlying `@blockrun/llm`
  SDK) and SHALL link to [x402.org](https://x402.org).
- DOC-README-013: THE README SHALL end with a Contributing section linking `./CONTRIBUTING.md` and a
  License line linking `./LICENSE`, mirroring `blockrun-mcp/README.md`'s closing structure.

---

## 2. CHANGELOG.md

- DOC-CHANGELOG-001: `/Users/anicca/blockrun-cli/CHANGELOG.md` SHALL exist and SHALL open with the
  same preamble line as `blockrun-mcp/CHANGELOG.md` ("All notable changes to `<project>` will be
  documented in this file.").
- DOC-CHANGELOG-002: THE CHANGELOG SHALL contain exactly one `## 1.0.0` heading (the first public
  release being documented by this feature) followed by bullet entries in the SAME format as
  `blockrun-mcp/CONTRIBUTING.md`'s documented CHANGELOG convention: `- **`area` — one-line
  headline.** 1-2 sentences.` — grouped/summarized by command area (wallet, chat, media
  image/video/music/speech/realface, data markets/price/dex/rpc/defi/surf/search/exa/modal/phone,
  budget/persistence, and the 18/18 E2E verification pass), sourced from the CLI's actual delivered
  scope (`execution-notes.md`, `VERIFICATION.md`), not invented history.
- DOC-CHANGELOG-003: THE CHANGELOG SHALL NOT contain any entry for a version other than `1.0.0` (no
  fabricated pre-1.0 history) unless a genuine prior tagged release exists in `git log --tags`.

---

## 3. CONTRIBUTING.md

- DOC-CONTRIB-001: `/Users/anicca/blockrun-cli/CONTRIBUTING.md` SHALL exist and SHALL mirror
  `blockrun-mcp/CONTRIBUTING.md`'s section structure — Setup, a design-rule section, an
  "Adding a new command" walkthrough, a CHANGELOG-entry convention, and a Pull Request checklist —
  translated from MCP terms to CLI terms.
- DOC-CONTRIB-002: THE Setup section SHALL list the REAL npm scripts from `/Users/anicca/blockrun-cli/
  package.json`: `npm install`, `npm run typecheck`, `npm run build`, `npm run dev`, `npm test`
  (and `npm run test:e2e` noted as requiring a funded sandbox wallet, mirroring `VERIFICATION.md`'s
  environment) — no invented script name.
- DOC-CONTRIB-003: THE design-rule section SHALL translate `blockrun-mcp/CONTRIBUTING.md`'s
  "Tool vs Skill" rule into this repo's actual architecture from `decisions.md`: when to add a new
  top-level `blockrun <command>` (mirrors a new MCP tool) versus extending an existing path-based
  passthrough command's alias table (mirrors `blockrun-mcp`'s "skill" for long endpoint catalogs) —
  it SHALL NOT reference "skills" as a concept this CLI has (the CLI has no skill-file mechanism;
  `blockrun-mcp`'s skill pattern does not exist here) and SHALL instead describe the CLI's real
  `args/<command>.ts` / `commands/<command>.ts` / `core/cost/<command>.ts` split (decisions.md §3/§5).
- DOC-CONTRIB-004: THE "Adding a new command" walkthrough SHALL reference the CLI's real file layout
  (`src/args/<command>.ts`, `src/commands/<command>.ts`, registration point in `src/index.ts`) and
  SHALL instruct running `npm run typecheck && npm run build && npm test` before opening a PR,
  mirroring `blockrun-mcp/CONTRIBUTING.md`'s equivalent checklist item.
- DOC-CONTRIB-005: THE x402 payment-pattern section SHALL describe the CLI's TWO real patterns from
  `decisions.md` §6 (`payOnce` for single probe→sign→resubmit; `payAndPoll` for async submit+poll,
  used by video/music) instead of `blockrun-mcp`'s `getWithPaymentRaw`/`requestWithPaymentRaw` +
  manual-402 split — same underlying SDK, CLI-specific wrapper names.
- DOC-CONTRIB-006: THE Pull Request checklist SHALL include: typecheck passes, build passes, test
  passes, new command added to the README `## Commands` table, CHANGELOG entry added, `package.json`
  version bumped — mirroring `blockrun-mcp/CONTRIBUTING.md`'s checklist shape with CLI-specific items.

---

## 4. LICENSE

- DOC-LICENSE-001: `/Users/anicca/blockrun-cli/LICENSE` SHALL exist and SHALL be the MIT License text,
  byte-identical in license body to `blockrun-mcp/LICENSE` except for the copyright line, which SHALL
  read a copyright holder consistent with `package.json`'s `author` field (DOC-PKG-002) and the current
  year.
- DOC-LICENSE-002: `package.json`'s `license` field SHALL read `"MIT"`, matching LICENSE.

---

## 5. package.json

- DOC-PKG-001: `/Users/anicca/blockrun-cli/package.json`'s `description` field SHALL be updated to an
  accurate one-line description of the CLI (parallel in style to `blockrun-mcp`'s package.json
  `description`, e.g. naming what it wraps, the payment mechanism, and "no API keys"/pay-per-call
  framing) — SHALL NOT claim MCP-server behavior.
- DOC-PKG-002: `package.json`'s `keywords` array SHALL include AT MINIMUM: `cli`, `blockrun`, `x402`,
  `micropayments`, `ai` (already present). MAY additionally include other CLI-appropriate keywords of
  the author's own choosing — these are NOT required to parallel `blockrun-mcp`'s actual keyword array
  (verified: `["mcp","claude","llm","ai","x402","micropayments","openai","anthropic","gemini",
  "blockrun","model-context-protocol"]`, which is oriented around its MCP-server/LLM-provider identity,
  not a generic "crypto/wallet" set). SHALL NOT include `mcp`, `model-context-protocol`, or `claude`
  (this package is not an MCP server; including those keywords would misrepresent it on an npm/GitHub
  search, violating REQ-NG-004's "no unimplemented feature" spirit).
- DOC-PKG-003: `package.json` SHALL gain a `repository` field of shape `{ "type": "git", "url":
  "https://github.com/Daisuke134/blockrun-cli" }`, mirroring `blockrun-mcp`'s `repository` field shape.
- DOC-PKG-004: `package.json` SHALL gain a `homepage` field. Since this project has no dedicated
  marketing site (unlike `blockrun-mcp`'s `https://blockrun.ai`), `homepage` SHALL point at the GitHub
  repository URL (`https://github.com/Daisuke134/blockrun-cli`) or its README anchor
  (`https://github.com/Daisuke134/blockrun-cli#readme`), never an invented external domain.
- DOC-PKG-005: `package.json`'s `bin` field SHALL remain `{ "blockrun": "./dist/index.js" }` (already
  correct — verified against REQ-001 of the CLI's own behavioral-spec.md) and SHALL NOT be altered by
  this feature.
- DOC-PKG-006: `package.json`'s `version` field SHALL be updated from the current `0.1.0` to `1.0.0`,
  reflecting the first externally-reviewable, 18/18-E2E-verified release.
- DOC-PKG-007: `package.json` SHALL gain a `bugs` field of shape `{ "url":
  "https://github.com/Daisuke134/blockrun-cli/issues" }`, mirroring `blockrun-mcp`'s `bugs` field.

---

## 6. PARITY.md (new evidence artifact)

Per Dais's direct instruction: the intended verifier and primary consumer of this whole feature is
**Claude Code itself** — this session already has all 18 corresponding MCP tools connected
(`mcp__blockrun__blockrun_wallet` … `mcp__blockrun__blockrun_surf`, confirmed present in this session's
tool list) — so "apple-to-apple with blockrun-mcp" is not just a structural README/CONTRIBUTING
comparison (§1-§5 above); it also means Claude Code can, and SHALL, directly execute the SAME input
through BOTH the connected MCP tool and the CLI command and compare real outputs side-by-side, for the
subset where this is cheap/free. This section defines that dual-execution requirement precisely,
grounded in ACTUAL calls already made during spec-writing (not hypothetical):

- DOC-PARITY-001: `/Users/anicca/blockrun-cli/PARITY.md` SHALL exist as a new file mapping all 18 CLI
  commands to their corresponding `blockrun-mcp` tool, one row/section per command, each stating: the
  MCP tool name (`blockrun_<name>`), the CLI command (`blockrun <name>`), the parameter-mapping rule
  (1:1 field names per REQ-022/REQ-003 of the CLI's own spec, noting any CLI-only additive flag such as
  `--budget-limit` or `video`'s `--max-quote-usd`), and an evidence pointer whose SOURCE depends on the
  command's tier (DOC-PARITY-004): a DUAL-LIVE-RUN record (DOC-PARITY-005) for the 9 free/cheap
  commands, or the matching row number in `VERIFICATION.md`'s 18-command ledger plus a schema-mapping
  comparison (DOC-PARITY-006) for the 9 paid/expensive commands.
- DOC-PARITY-002: `PARITY.md` SHALL explicitly flag any INTENTIONAL non-parity point already recorded
  in the CLI's own spec/decisions (e.g. `--budget-limit`/persisted ledger being CLI-only per decisions
  §8-9, `--max-quote-usd` being CLI-only per decisions §11, tool *profiles* being out of scope per
  REQ-NG-006) rather than silently omitting them, so an external verifier can distinguish "different
  by design" from "missing."
- DOC-PARITY-003: `PARITY.md` SHALL be internally consistent with `VERIFICATION.md` — every cost figure
  and evidence reference in `PARITY.md` SHALL match the corresponding row in `VERIFICATION.md` exactly
  (same command, same cost, same evidence id/tx), verified mechanically (Tier-1 automated check, see
  verification-architecture.md).
- DOC-PARITY-004: THE 18 commands SHALL be partitioned into exactly two verification tiers (an
  exhaustive, non-overlapping partition, per Dais's instruction and mirroring the exact examples given):
  **DUAL-LIVE-RUN tier** (9: `wallet`, `chat`, `models`, `dex`, `price`, `defi`, `markets`, `rpc`,
  `phone`) — cheap enough ($0 to $0.002/call) to actually execute through BOTH surfaces without
  meaningful spend; **SCHEMA-ONLY tier** (9: `image`, `video`, `music`, `realface`, `modal`, `speech`,
  `search`, `exa`, `surf`) — expensive/variable-cost enough that this feature SHALL NOT re-execute them
  against the MCP side (avoiding double real-money spend on top of the CLI-side fresh re-runs already
  required by DOC-EVID-001/PROP-020).
- DOC-PARITY-005 (DUAL-LIVE-RUN tier): for each of the 9 commands in that tier, THE FEATURE SHALL
  invoke the connected `mcp__blockrun__blockrun_<name>` tool AND the CLI's `<name> --json` with the SAME
  semantic input, and record BOTH raw JSON outputs plus a structural comparison in `PARITY.md`. The
  comparison standard is NOT "byte-identical" — it is "same underlying facts, explain any structural
  difference" — grounded in four ALREADY-PERFORMED comparisons (real calls made 2026-07-08, not
  hypothetical, captured here so Phase 3/4 does not need to re-derive the expected shapes from
  scratch):
  - `dex --query SOL` (MCP) vs `dex --query SOL --json` (CLI): output is BYTE-IDENTICAL — both proxy
    the same DexScreener API directly, no wallet/formatting divergence. This is the BASELINE case: a
    pure-passthrough command SHOULD show zero structural difference.
  - `price --action price --category crypto --symbol BTC-USD` (MCP) vs the equivalent CLI `--json`
    call: IDENTICAL field set (`symbol, price, publishTime, confidence, feedId, timestamp, assetType,
    category, source, free`), including an identical `feedId`; only the live `price`/`publishTime`
    values differ (a few seconds apart on the same Pyth feed) — EXPECTED, not a finding.
  - `chat --message "what is 2+2?" --mode free` (MCP) vs the equivalent CLI call: IDENTICAL field set
    (`model_used, response`) — matches the shape `VERIFICATION.md` row #5 already captured for the CLI
    side; only `model_used`'s VALUE differs (the free tier auto-picks any currently-healthy free NVIDIA
    model — MCP returned `nvidia/deepseek-v4-flash`, `VERIFICATION.md`'s CLI run returned
    `nvidia/llama-4-maverick`) — EXPECTED, not a finding.
  - `wallet --action status` (MCP) vs `wallet --action status --json` (CLI): a REAL, ALREADY-CONFIRMED
    structural DIFFERENCE — MCP flattens the ACTIVE chain's `address`/`balance` to top-level fields and
    ADDS `network`, `chainId`, `isNew`, `explorerUrl`, `explorerLabel`, plus a nested `wallets:{base,
    solana}` sub-object; the CLI instead exposes `base`/`solana` as top-level keys directly with NO
    extra metadata fields. Both represent the SAME underlying `@blockrun/llm` wallet data — this is
    each side's OWN independent rendering/formatting code, not a functional gap — but `PARITY.md`
    SHALL record this as an EXPLICIT structural-difference finding (not silently normalized away),
    per DOC-PARITY-002's "different by design, not missing" principle.
  - `models --category chat` (MCP) vs `models --category chat --json` (CLI): a REAL, ALREADY-CONFIRMED
    finding with TWO distinct dimensions: (a) field-naming differs — MCP uses snake_case
    (`owned_by`, `context_window`, `max_output`, `billing_mode`, nested `pricing:{input,output}`); CLI
    uses camelCase (`provider`, `contextWindow`, `maxOutput`, `billingMode`, flat `inputPrice`/
    `outputPrice`) — and MCP additionally carries `object`/`created` fields the CLI omits, while CLI
    carries `available`/`type` fields MCP omits; (b) the RESULT COUNT differs for the identical
    `category:"chat"` filter — MCP returned 44 models, CLI returned 55 — a genuine count mismatch,
    not merely a formatting difference. `PARITY.md` SHALL record BOTH the field-naming divergence and
    the count divergence verbatim (with the actual counts, 44 vs 55) as a finding for the CLI feature
    owner to triage (this docs feature does NOT investigate or fix the root cause — REQ-NG-001 forbids
    touching `src/`; it only documents the finding honestly, per DOC-CONSTRAINT-002's no-lies rule).
  For the remaining 5 of the 9 DUAL-LIVE-RUN commands not yet exercised at spec-writing time (`defi`,
  `markets`, `rpc`, `phone`, plus re-confirming `wallet`/`models`/`chat`/`price`/`dex` at execution
  time), Phase 3/4 SHALL perform the same dual-invocation-and-compare procedure and record real,
  freshly-captured results — not assume the four cost-bearing ones ($0.001-$0.002 each) behave like
  the already-tested $0 ones.
- DOC-PARITY-005a (funding precondition, ALREADY-CONFIRMED, mechanically checkable): the MCP wallet
  connected to THIS session (checked live 2026-07-08 via `mcp__blockrun__blockrun_wallet` action
  `status`) reported Base address `0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e` balance `0` and Solana
  address `8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9` balance `0` (active chain: solana) — meaning
  the 4 PAID members of the DUAL-LIVE-RUN tier (`defi` $0.001, `markets` $0.001, `rpc` $0.002, `phone`
  numbers/list $0.001) CANNOT be dual-executed against THIS wallet without funding it first, while the
  5 genuinely-`$0` members (`wallet`, `chat` mode=free, `models`, `dex`, `price` crypto/fx/commodity)
  require NO funding and are executable immediately. THE FEATURE SHALL check this MCP wallet's live
  balance (same `blockrun_wallet` status call) BEFORE attempting any of the 4 paid dual-live-run
  commands, and SHALL request funding (or fall back to schema-only comparison for that specific command,
  recorded as such in `PARITY.md`) rather than silently skip the comparison if funding is unavailable.
- DOC-PARITY-006 (SCHEMA-ONLY tier): for each of the 9 commands in that tier, `PARITY.md`'s comparison
  SHALL consist of (a) the connected MCP tool's declared JSON-schema parameters (retrievable via this
  session's own tool definitions — no network call needed, since these tools are already loaded) mapped
  field-by-field against the CLI's `src/args/<command>.ts` schema (already required by DOC-PARITY-001's
  parameter-mapping rule), and (b) the CLI-side real-execution evidence already required by
  DOC-EVID-001..005/PROP-020 (for `image`/`video`/`music`) or `VERIFICATION.md`'s existing 18-row ledger
  (for the other 6: `realface`, `modal`, `speech`, `search`, `exa`, `surf`) — THE MCP side of these 9
  commands SHALL NOT be independently re-executed by this feature; parameter-schema comparison is
  sufficient evidence for this tier, and re-running a paid command through both surfaces would be
  redundant spend for the same verification purpose.
- DOC-PARITY-007 (verifier identity, review-process framing): THE PRIMARY verifier for both tiers is
  Claude Code itself — the SAME agent/session driving this feature, using its own connected MCP tools
  — not an external human reviewer and not `codex-review` (a prior draft of this spec cited
  `codex-review` gate findings from spec-review history; those citations are RETAINED as factual
  records of past spec-review iterations per Dais's instruction, but `codex-review` is NOT a required
  gate for any future phase of this feature — the sole review mechanism going forward is a
  fresh-context Claude adversary instance, per PROP-018 in verification-architecture.md).

---

## 6a. Media artifact full-URL evidence (image / music / video)

Precheck finding (confirmed by direct inspection, not assumed): `VERIFICATION.md`'s rows #13
(`image`), #15 (`music`), #16 (`video`) record TRUNCATED artifact URLs (pattern
`…/<short-id>-….<ext>`). A full-URL recovery attempt was made and FAILED — `git log --all -p --
VERIFICATION.md` contains no full media URL, the e2e sandbox HOME
(`/Users/anicca/blockrun-cli-e2e-home/.blockrun/cost_log.jsonl`) logs only `endpoint`+`cost_usd`
(no artifact URL), and no other log under `.vcsdd/` retains one. Recovery is therefore NOT possible
for any of the three; a fresh re-run is REQUIRED for all three artifacts.

- DOC-EVID-001: THE FEATURE SHALL obtain the FULL, non-truncated hosted URL for **ALL THREE** of the
  media artifacts (`image`, `music`, `video`) — this REQ is satisfied ONLY when all three full URLs
  have been obtained; obtaining fewer than three (e.g. skipping `music` for any reason, including
  insufficient balance) does NOT satisfy DOC-EVID-001, matching the goal's Done condition (three
  media artifacts each independently HTTP-200-verified). Each is obtained via a FRESH re-run of that
  exact command at its cheapest real path, against the SAME sandbox HOME
  (`/Users/anicca/blockrun-cli-e2e-home`) used by the original `VERIFICATION.md` E2E pass — since
  recovery from existing evidence is confirmed impossible (see precheck finding above): `image` (same
  model class, ≈$0.015), `video` (`--duration-seconds 1 --resolution 360p`, ≈$0.0525, mirroring
  `VERIFICATION.md` row #16's exact invocation), `music` (default model, ≈$0.1575).
- DOC-EVID-002: IMMEDIATELY BEFORE executing the fresh re-run sequence in DOC-EVID-001 (and again
  before EACH subsequent step in that sequence), THE FEATURE SHALL run a LIVE balance preflight using
  the EXACT invocation `HOME=/Users/anicca/blockrun-cli-e2e-home node dist/index.js wallet --action
  status --json`, and parse the numeric field at JSON path `.base.balance` from stdout (the verified
  real output shape is `{"activeChain":"base","base":{"address":"0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804","balance":<number|null>},"solana":{...}}`
  — confirmed by direct execution of this exact command: on 2026-07-08 it returned a numeric
  `base.balance:0.264748`; TWO separate later executions during spec-review both returned
  `base.balance:null` (most recently confirmed live during spec-review it-4 codex ADV-004-003 —
  `.base.balance` is `null` as of that check) — BOTH outcomes are real and repeatedly observed,
  consistent with `blockrun-mcp/README.md`'s own documented "Base RPC transient outage"
  troubleshooting entry (note: `wallet --action status`'s OWN implementation, per
  `src/shell/wallet.ts:234-255`'s `getBaseUsdcBalance()`, already tries 3 free public Base RPCs —
  `mainnet.base.org`, `base.llamarpc.com`, `1rpc.io/base` — before giving up and returning `null`; a
  `null` result means all three already failed) — so this REQ and DOC-EVID-002a below MUST handle
  both outcomes, and it is LIKELY (not merely hypothetical) that a real run of this feature will hit
  the `null` branch given the observed frequency. THAT live-read numeric value (never
  `VERIFICATION.md`'s dated $0.264748 figure, which was recorded 2026-07-07 and is a stale reference
  only) is the actual remaining-balance input for every subsequent check in this section. Re-runs
  SHALL proceed cheapest-first (image → video → music). For the settled-cost side of each check (the
  amount actually spent by the PRECEDING re-run in the sequence, needed to compute the running total),
  THE FEATURE SHALL invoke each media command with `--json` and read its `cost_usd` field from stdout,
  cross-checked against the delta in `~/.blockrun/cli-budget.json`'s `global.spent` (read before and
  after that re-run) — these two SHALL agree; a mismatch is treated as an indeterminate balance (see
  DOC-EVID-002a's fallback chain).
- DOC-EVID-002a (balance-unknown handling — mechanically executable, no out-of-band judgment, and NO
  derived/estimated value may ever authorize a paid media re-run — revised per spec-review codex it-4
  FIND-004-001/FIND-004-002, which found the previously-specified ledger-derived "conservative lower
  bound" was NOT actually conservative: real numbers are `$0.59` funding − `$0.316001` recorded
  `global.spent` = `$0.273999`, which is HIGHER than `VERIFICATION.md`'s own recorded end balance of
  `$0.264748` — an over-estimate by ~$0.0092, exactly the failure mode FIND-004-001 flagged. The
  ledger-derived-floor branch is THEREFORE REMOVED as a basis for proceeding): WHEN DOC-EVID-002's
  preflight returns `base.balance` as `null`, non-numeric, or the process exits nonzero, THE FEATURE
  SHALL treat the balance as UNKNOWN and SHALL NOT start or continue any paid re-run against an
  unknown balance. Resolution order (exactly two paths to a balance THE FEATURE MAY ACT ON — no
  third, estimated path):
  1. Retry the EXACT DOC-EVID-002 preflight command up to 3 times with a 30-second wait between
     attempts (mirrors `blockrun-mcp/README.md`'s own "retry after 30s" RPC-outage guidance). IF a
     retry returns a number, use it.
  2. IF still non-numeric after 3 retries, attempt the ON-CHAIN fallback via THIS EXACT invocation —
     which independently re-derives the SAME `balanceOf` call `wallet --action status` already tries
     for free (step DOC-EVID-002's note above), but routed through BlockRun's PAID Tatum-backed
     gateway (`/v1/rpc/base`, per `blockrun-mcp/README.md`'s `blockrun_rpc` tool description) instead
     of the 3 free public RPCs that already failed — a genuinely independent upstream, not a retry of
     the same thing:
     ```
     HOME=/Users/anicca/blockrun-cli-e2e-home node dist/index.js rpc --network base --method eth_call \
       --params '[{"to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","data":"0x70a08231000000000000000000000000a5cef4943c3f8f34e5138b5bcde6b88746a5c804"},"latest"]' \
       --json
     ```
     Every component of this invocation is verified against the CLI's OWN source (not invented):
     `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the Base USDC contract address the CLI's own
     `src/shell/wallet.ts:25` (`USDC_ADDRESS` constant) already uses; `0x70a08231` is the standard
     ERC-20 `balanceOf(address)` 4-byte selector, followed by the sandbox wallet address
     (`0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804`, lowercased, `0x`-stripped) left-zero-padded to 32
     bytes — the EXACT calldata construction at `src/shell/wallet.ts:238`
     (`` `0x70a08231000000000000000000000000${address.slice(2)}` ``); DECODE the JSON-RPC response's
     `result` hex field as `Number(BigInt(result)) / 1e6` (USDC has 6 decimals) — the EXACT decode
     logic already implemented and exported as `parseBaseUsdcCallResult()` at
     `src/shell/wallet.ts:229-232`. Real cost: $0.002 (`RPC_PRICE_USD`, `src/args/rpc.ts:9`) — no
     prior balance check gates this attempt (if the wallet cannot actually afford $0.002, the
     underlying x402 payment settlement itself fails cleanly as a payment-rejection error, not a
     false success — this is the CLI's own existing money-safety property, REQ-220/REQ-221 — so
     attempting it unconditionally here is safe).
  3. IF the on-chain fallback in step 2 ALSO fails (nonzero exit, malformed/missing `result`, or a
     payment-rejection error), THE FEATURE SHALL STOP the entire sequence and report the failure
     immediately. `~/.blockrun/cli-budget.json`'s `global.spent` and the known $0.59 funding amount
     (tx `0xccbaf5adeb67e2e144be9dd091b9533a951eb7c2ea5189dff0a02e0d33f4bbe3`, per `VERIFICATION.md`'s
     Environment table) MAY be written to the evidence output as a REFERENCE/cross-check figure ONLY
     — proven NOT to be a safe lower bound (see this REQ's opening paragraph) — and SHALL NEVER be
     used to justify proceeding with a paid re-run, a top-up decision, or ANY spend when both step 1
     and step 2 have failed. Fabricating a balance or proceeding blind is NOT permitted under any
     circumstance.

  WHEN a resolved balance (live preflight number, per step 1, or the on-chain fallback number, per
  step 2 — NEVER a ledger-derived estimate, which step 3 above forbids as a spend-authorizing source)
  is insufficient for the next cheapest-first step's real cost (its 402 quote if already known from a
  prior attempt, else its cost estimate
  from DOC-EVID-001), THE FEATURE SHALL: (1) STOP before attempting that step; (2) the ORCHESTRATOR
  (a human operator or the agent session driving this feature — this transfer is OUTSIDE the CLI
  process itself, since the CLI has no send-funds command; whoever holds the
  `0x810f6d61f7606deee2657d3083e150a222bc29c5` signing key performs it) sends a top-up to the sandbox
  Base wallet `0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804`, sized as `shortfall + $0.05 margin` where
  `shortfall = next-step-cost − resolved-balance` — the SAME funding route used to originally fund the
  sandbox for `VERIFICATION.md` (see `execution-notes.md`'s "E2E 資金" section); (3) record the
  transfer's tx hash in `.vcsdd/features/blockrun-cli-docs/evidence/` (a `topup-<n>.json` record: from
  address, to address, amount, tx hash, timestamp); (4) re-run DOC-EVID-002's preflight to confirm the
  top-up landed, retrying up to 3 times with a 2-minute wait between attempts (10-minute total budget);
  IF the top-up has NOT reflected in the live balance after 3 retries / 10 minutes, THE FEATURE SHALL
  STOP and report this as a failure (do NOT assume the transfer succeeded, do NOT fabricate a result);
  (5) IF confirmed, RESUME the re-run sequence from the stopped step. WHEN the orchestrator cannot send
  the top-up (no signing access, insufficient source-wallet funds, or any send failure), THE FEATURE
  SHALL STOP and report this immediately — this is a terminal failure state for this run, not silently
  worked around. DOC-EVID-001 remains UNSATISFIED (the feature is NOT done) until all three full URLs
  have been obtained via this process; a top-up-then-resume cycle SHALL be repeated as many times as
  needed, but recording any artifact as "skipped" is NEVER an acceptable terminal state for this REQ.
- DOC-EVID-003: EVERY full URL obtained per DOC-EVID-001 SHALL be verified to resolve with an HTTP
  200 (or equivalent successful) status — a live network check (Tier 3, see
  verification-architecture.md).
- DOC-EVID-004: THE evidence record saved under `.vcsdd/features/blockrun-cli-docs/evidence/` for each
  of the three artifacts SHALL contain, at minimum, the full URL and the downloaded bytes' MD5
  checksum + byte size — but the SETTLEMENT-PROOF field differs by command, because their real JSON
  output shapes differ (verified directly from `src/commands/{image,video,music}.ts`): for `video` and
  `music`, whose `--json` output conditionally includes a `txHash` field (populated from the
  `X-Payment-Receipt` response header when present, per `src/shell/manual-x402.ts`), the evidence
  record SHALL include that `txHash` as its settlement proof. For `image`, whose real success payload
  is `{ url, prompt, model, cost_usd }` with NO `txHash`/settlement-header field anywhere in its output
  (the SDK's `client.generate()`/`client.edit()` path used by `image`, unlike video/music's manual x402
  probe-poll flow, never surfaces one) — this is NOT a doc-writing gap, it is a real absence in the
  underlying command output — the evidence record's settlement proof SHALL instead be: the `cost_usd`
  value from `image`'s own `--json` response, CROSS-CHECKED against the delta in
  `~/.blockrun/cli-budget.json`'s `global.spent` recorded immediately before and after the `image`
  re-run (per DOC-EVID-002's ledger cross-check). `PARITY.md`'s rows for these three commands SHALL
  reference these evidence files (path + MD5 + the applicable settlement-proof field) as their evidence
  pointer, extending (not replacing) DOC-PARITY-001's general VERIFICATION.md-row reference for those
  three commands specifically.
- DOC-EVID-005: `VERIFICATION.md` SHALL be updated (rows #13/#15/#16, or a dated appendix) to record
  the full non-truncated URL obtained per DOC-EVID-001, so its evidence column and
  `PARITY.md`/`evidence/`'s records for these three artifacts state the SAME full URL — the documents
  SHALL NOT diverge (extends DOC-PARITY-003's cross-file consistency rule to this new full-URL data).

---

## 7. execution-notes.md maintenance

- DOC-NOTES-001: `/Users/anicca/blockrun-cli/execution-notes.md` (the SAME file used by the
  `blockrun-cli` feature) SHALL be updated during this feature's work with a new dated section
  recording this docs-feature's pass/fail progress (files created, verification results), consistent
  with the file's existing "State" / "Decisions" / "Evidence log" structure — not replaced or
  overwritten wholesale.

---

## 8. Cross-cutting constraints

- DOC-CONSTRAINT-001: THE `src/`, `test/`, and `dist/` directories SHALL NOT be modified by this
  feature (REQ-NG-001). If any README/CONTRIBUTING example command does not actually work against the
  real built binary, the DOCUMENT SHALL be corrected to match real behavior — the source SHALL NOT be
  changed to match an aspirational doc.
- DOC-CONSTRAINT-001a (narrow exception, added Phase 3/4 per Dais's direct instruction): THE ONE
  exception to DOC-CONSTRAINT-001 is the release version literal at `src/index.ts`'s
  `.version("…")` call (Commander's own `--version` flag value) — this feature MAY change ONLY that
  one string literal, from `"0.1.0"` to `"1.0.0"`, to resolve a real, user-visible inconsistency: the
  built binary's `blockrun --version` output (hardcoded, independent of `package.json`) must match
  `package.json`'s `version` field (DOC-PKG-006 requires `"1.0.0"`) before a `v1.0.0` git tag is cut,
  or an external reviewer running `blockrun --version` would see `0.1.0` against a `package.json`
  claiming `1.0.0` — a real, easily-caught inconsistency, not a hypothetical one. NO OTHER LINE in
  `src/`/`test/`/`dist/` may change under this exception. THE FEATURE SHALL mechanically verify this
  exception's boundary is respected (PROP-016b, verification-architecture.md) — `git diff` against
  `src/` SHALL show EXACTLY one changed line, and that line SHALL be the `.version(...)` literal.
- DOC-CONSTRAINT-002: No produced document SHALL contain the words "coming soon", "TBD", "planned", or
  an equivalent placeholder for an unimplemented feature (REQ-NG-004).
- DOC-CONSTRAINT-003: Every numeric cost, flag name, enum value, and environment variable named in any
  produced document SHALL be traceable to one of: a live `--help` output capture, `VERIFICATION.md`,
  `decisions.md`, or the CLI's own `behavioral-spec.md` — never invented or estimated.

---

## 9. Traceability

Every DOC-* requirement above names its grounding source (blockrun-mcp reference file, or the CLI's
own VERIFICATION.md/decisions.md/behavioral-spec.md/live `--help` output) inline, for the adversary and
the external BlockRun reviewers to cross-check against the same sources this spec was written from.
