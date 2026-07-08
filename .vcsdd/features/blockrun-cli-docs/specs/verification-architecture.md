# blockrun-cli-docs — Verification Architecture

Feature: `blockrun-cli-docs` · Mode: lean · Phase 1b

Maps `specs/behavioral-spec.md`'s DOC-* requirements to proof obligations (PROP-*). Docs are static
artifacts — most checks are Tier-1 (mechanical, no network, no spend). Per Dais's direct instruction,
the primary verifier is Claude Code itself, driving BOTH the CLI (Bash) and the 18 connected
`mcp__blockrun__blockrun_*` MCP tools to compare real outputs side-by-side for the cheap/free command
subset (PROP-023) — this ADDS a second real-spend proof obligation on a wallet SEPARATE from the CLI
sandbox. FIVE proof obligations are network-touching: **PROP-005** (a free-path, `$0` CLI command —
network-touching, NOT a real spend surface), **PROP-019** and **PROP-021** (HTTP resolution checks —
network-touching, no spend), **PROP-020** (image/video/music fresh re-runs against the CLI sandbox
wallet — network-touching AND a real-spend proof obligation, ≈$0.225-$0.231 total, gated by a live
wallet-balance preflight — see §3, Budget guard, corrected per spec-review codex it-1 FIND-002/FIND-003
and it-2 ADV-001-SPEND-SURFACE-WORDING), and **PROP-023** (the MCP-side dual-live-run comparisons — up
to ≈$0.008 total on the SEPARATE MCP-connected wallet, distinct from and not netted against PROP-020's
sandbox budget).

Kept intentionally lean: 25 PROPs covering the 50 DOC-* requirements in behavioral-spec.md by grouping
requirements that share one mechanical check (e.g. "18 rows present," "these 6 env vars and no others")
into a single PROP rather than one PROP per REQ — no padding.

---

## 1. Purity boundary

| Layer | Nature | Examples |
|---|---|---|
| Pure | Docs-check script's parsing/comparison logic (markdown section extraction, JSON field diff, table-row counting, forbidden-term grep); static MCP-tool-schema vs CLI-args-schema diff (PROP-025, no tool call) | `scripts/docs-check.*` internals |
| Impure (network, no spend) | Live command execution against the real BlockRun API on a free-cost path (PROP-005); HTTP HEAD/GET for URL resolution (PROP-019, PROP-021) | `--json`/`--help` example runs; github.com / x402.org reachability; the 3 recovered media URLs |
| Impure (network, **real spend — CLI sandbox wallet**) | Live wallet-balance preflight (`wallet --action status --json`, no spend) immediately followed by fresh media re-runs that DO spend real USDC (PROP-020) | image/video/music fresh re-runs against sandbox HOME |
| Impure (network, **real spend — MCP-connected wallet, separate from the CLI sandbox**) | Dual invocation of a connected `mcp__blockrun__blockrun_<name>` tool AND the equivalent CLI command for the 9 DUAL-LIVE-RUN commands; 5 are `$0`, 4 (`defi`/`markets`/`rpc`/`phone`) cost $0.001-$0.002 each on THIS wallet (PROP-023) | `blockrun_wallet`/`blockrun_chat`/`blockrun_models`/`blockrun_dex`/`blockrun_price` (already exercised, $0) plus `blockrun_defi`/`blockrun_markets`/`blockrun_rpc`/`blockrun_phone` (require funding first) |
| Impure (filesystem, no network) | Reading repo files, `git diff` against this feature's commit range, `git log --tags` | PROP-016 |
| Out of scope entirely | Anything under `src/`, `test/`, `dist/` — this feature reads them (to verify docs match real `--help` output) but never writes them (REQ-NG-001 / DOC-CONSTRAINT-001) | n/a |

The docs-check script (Tier 1, PROP-001/002/003/006/007/008/009/010/011/012/013/015/016/017/024/025)
SHALL be a
single executable (`scripts/docs-check.ts` or `.sh`, Phase 2's choice) that takes no network access and
exits nonzero on any failing check, printing which PROP failed — this is the Red/Green artifact for
Phase 2a/2b of THIS feature (not the CLI's own 408-test suite, which is untouched per REQ-NG-001).

---

## 2. Proof obligations

### Tier 1 — automated docs-check script (no network, no spend)

- **PROP-001** (DOC-README-001, -002, -013) — README.md exists; its `##`-level headings appear in the
  exact order VERIFIED against the real `blockrun-mcp/README.md` (`grep -n '^#'`): Prerequisites →
  Install → Fund your wallet → Commands → (usage-examples heading, any name — positionally corresponds
  to `blockrun-mcp`'s Tips/Key-Use-Cases block) → Multi-agent budget delegation → Troubleshooting →
  Environment Variables → How it works → Contributing → License. Assert: ordered substring match of
  heading list against this required sequence (Prerequisites and Install SHALL NOT be swapped;
  Environment Variables SHALL appear AFTER, not before, Multi-agent budget delegation and
  Troubleshooting — this is the corrected order per spec-review FIND-001/002, replacing an earlier
  draft that had both of these wrong).
- **PROP-002** (DOC-README-006) — README's `## Commands` table has exactly 18 data rows, and the set of
  command names in column 1 equals the set of 18 real subcommand names parsed from `node dist/index.js
  --help`'s `Commands:` block (excluding the auto-generated `help [command]` row). Assert: set equality,
  count === 18.
- **PROP-003** (DOC-README-002, -009, -010, -011; also enforces REQ-NG-002/-004, this docs-feature's
  own non-goals, which have no dedicated PROP of their own) — README.md does NOT contain (case
  -insensitive): `"model-context-protocol"`, `"claude mcp add"`, `"tool profiles"`, `"spawn npx enoent"`,
  `"coming soon"`, `"tbd"`, `"planned"`. Assert: zero matches for each forbidden string.
- **PROP-006** (DOC-README-009) — README's Environment Variables table has exactly 6 data rows, and
  the Variable/File column set equals exactly `{BLOCKRUN_BUDGET_LIMIT, ~/.blockrun/.session,
  ~/.blockrun/.chain, ~/.blockrun/payment-chain, ~/.blockrun/.solana-session, SOLANA_WALLET_KEY}` —
  `~/.blockrun/.chain` and `~/.blockrun/payment-chain` SHALL each be their OWN row (a combined
  `~/.blockrun/.chain` `/` `~/.blockrun/payment-chain` single-cell rendering FAILS this check, per
  DOC-README-009's explicit "SHALL each get their OWN row" clarification, spec-review FIND-004) — and
  does NOT contain `BLOCKRUN_API_BASE_URL` or `BLOCKRUN_HOME`. Assert: row count === 6, set equality
  over the 6 rows, + explicit absence check for the two excluded variables.
- **PROP-007** (DOC-CHANGELOG-001, -002, -003) — CHANGELOG.md exists; first non-blank line matches the
  preamble pattern; exactly one line matches `^## 1\.0\.0$`; no other `^## \d` heading exists unless a
  matching tag is found via `git log --tags --format=%D`; every bullet under `## 1.0.0` matches
  `^- \*\*.+ — .+\.\*\*`. Assert: regex counts and format match.
- **PROP-008** (DOC-CONTRIB-001, -002, -003) — CONTRIBUTING.md exists; contains the literal strings
  `npm install`, `npm run typecheck`, `npm run build`, `npm run dev`, `npm test`, `npm run test:e2e`
  (verbatim from `package.json` `scripts` keys — parsed from package.json, not hardcoded in the check,
  so a future script rename can't silently desync). Refined ban (loosened per spec-review codex
  ADV-002, which flagged the original standalone-word ban as brittle enough to false-fail a legitimate
  sentence explaining the CLI has no skill mechanism): does NOT contain the structural artifact strings
  `"skills/<name>/"`, `"SKILL.md"`, or an imperative instruction of the shape "add a new skill" /
  "create a skill" — i.e. anything that would claim or instruct building an actual skill-file mechanism
  in THIS repo. The bare word "skill" used descriptively (e.g. explaining that `blockrun-mcp` has a
  skill mechanism and this CLI intentionally does not, per DOC-CONTRIB-003) is PERMITTED and SHALL NOT
  be flagged. Assert: substring/pattern presence for the required scripts; absence of the three
  structural-claim patterns above.
- **PROP-009** (DOC-CONTRIB-006) — CONTRIBUTING.md's PR checklist section (a markdown task-list block)
  contains 6 items matching: typecheck, build, test, README Commands table, CHANGELOG entry, version
  bump. Assert: 6 checklist-item substrings present.
- **PROP-010** (DOC-LICENSE-001, -002) — LICENSE exists; its body (all lines except the copyright line)
  is byte-identical to `blockrun-mcp/LICENSE`'s body; `package.json.license === "MIT"`. Assert: diff of
  license bodies with the copyright line stripped from both sides; exact string match on `license`.
- **PROP-011** (DOC-PKG-001..007) — `package.json` field checks, all via `JSON.parse`: `description` is
  non-empty and does not match `/\bMCP\b/i` or `/model context protocol/i`; `keywords` is a superset of
  `["cli","blockrun","x402","micropayments","ai"]` and excludes `"mcp"`, `"model-context-protocol"`,
  `"claude"`; `repository.url === "https://github.com/Daisuke134/blockrun-cli"` (or the `git+` variant);
  `homepage` is a non-empty string starting `https://github.com/Daisuke134/blockrun-cli`; `bin` deep
  -equals `{"blockrun":"./dist/index.js"}` (unchanged — regression guard for DOC-PKG-005); `version ===
  "1.0.0"`; `bugs.url === "https://github.com/Daisuke134/blockrun-cli/issues"`.
- **PROP-012** (DOC-PARITY-001) — PARITY.md exists; contains exactly 18 sections/rows (one per real
  subcommand name, same set as PROP-002's 18 names), each naming both the `blockrun_<name>` MCP-tool
  form and the `blockrun <name>` CLI form. Assert: 18 matched pairs, set equality against the real
  command-name list.
- **PROP-013** (DOC-PARITY-002) — PARITY.md contains explicit call-outs (substring match) for the three
  known intentional non-parity points: `--budget-limit`/persisted-ledger, `--max-quote-usd`, and tool
  profiles being out of scope. Assert: 3 substrings present.
- **PROP-015** (DOC-NOTES-001) — `execution-notes.md` contains a section whose heading or body
  references `blockrun-cli-docs` AND a date matching today's date (`YYYY-MM-DD`, UTC) at time of the
  Tier-1 run. Assert: substring + date-pattern match, run at Phase 3 (not a stale historical mention).
- **PROP-016** (DOC-CONSTRAINT-001; also enforces REQ-NG-001, this docs-feature's own non-goal, which
  has no dedicated PROP of its own) — `git diff <feature-start-commit>..HEAD --name-only`
  contains ONLY paths matching one of: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`,
  `package.json`, `PARITY.md`, `VERIFICATION.md`, `execution-notes.md`, `scripts/docs-check.*`,
  `.vcsdd/**`. `VERIFICATION.md` is explicitly in the allow-list because DOC-EVID-005/PROP-022(b)
  REQUIRE this feature to update it with the recovered full media URLs — omitting it here would make
  PROP-016 FAIL against the feature's own required work (spec-review iteration-2 FIND-001; an earlier
  draft omitted it, contradicting DOC-EVID-005). The allow-list entry `.vcsdd/**` was WIDENED from
  `.vcsdd/features/blockrun-cli-docs/**` (per Dais's direct instruction during Phase 2b) because the
  VCSDD orchestrator itself writes shared, repo-wide state-machine bookkeeping files OUTSIDE this
  feature's own directory as an unavoidable side effect of running ANY vcsdd command —
  `.vcsdd/active-feature.txt`, `.vcsdd/history.jsonl`, `.vcsdd/index.json` — confirmed by running
  `scripts/docs-check.mjs` during Phase 2a's Red-phase evidence run, which found exactly these three
  paths outside the narrower allow-list even though NO feature-specific docs work had touched them.
  PROP-016's actual protective INTENT is `src/`/`test`/`dist`-untouched (REQ-NG-001), not literal
  isolation from the orchestrator's own cross-feature state files, which this feature cannot avoid
  touching by using `vcsdd` tooling at all. Assert: every changed path matches the allow-list; zero
  paths under `test/`, `dist/`; zero paths under `src/` EXCEPT `src/index.ts`, which — if changed at
  all — is checked by the separate, stricter PROP-016b below (a bare "no src/ changes" assertion would
  now be too strict, since DOC-CONSTRAINT-001a authorizes exactly one line in `src/index.ts`; a bare
  "any src/ change is fine" assertion would be too loose — PROP-016b is the precise boundary check).
- **PROP-016b** (DOC-CONSTRAINT-001a; Tier 1, filesystem, no network — added Phase 3/4 per Dais's
  direct instruction) — THE version-literal exception's boundary, verified line-by-line, not just
  file-by-file: `git diff <feature-start-commit>..HEAD -- src/` SHALL show EXACTLY ONE changed line
  across the ENTIRE `src/` tree, and that line SHALL match the pattern `.version("<semver>")` (a
  Commander `.version(...)` call). ANY other change under `src/` (a second line in `index.ts`, or any
  change to any other file under `src/`) FAILS this PROP. This is INTENTIONALLY stricter than a
  file-level check — DOC-CONSTRAINT-001a authorizes one LINE, not one FILE, so the mechanical check
  must operate at line granularity to actually enforce the narrow exception rather than silently
  widening it to "the whole of `src/index.ts` is now fair game."
- **PROP-017** (DOC-CONSTRAINT-002) — every produced doc file (README/CHANGELOG/CONTRIBUTING/LICENSE/
  PARITY.md) is free of the forbidden-placeholder set from PROP-003, re-checked across ALL files (PROP
  -003 is README-only; this PROP covers the rest). Assert: zero matches across the file set minus
  README.md (already covered).
- **PROP-024** (DOC-PARITY-004) — PARITY.md's per-command tier label SHALL exactly match the specified
  partition: `wallet`, `chat`, `models`, `dex`, `price`, `defi`, `markets`, `rpc`, `phone` are each
  labeled DUAL-LIVE-RUN; `image`, `video`, `music`, `realface`, `modal`, `speech`, `search`, `exa`,
  `surf` are each labeled SCHEMA-ONLY. Assert: exactly 9+9, no command unlabeled or double-labeled, set
  equality against the real 18-command list (same set PROP-002/012 already establish).
- **PROP-025** (DOC-PARITY-006; Tier 1 — no network beyond already-loaded MCP tool definitions, no
  spend) — for each of the 9 SCHEMA-ONLY commands, PARITY.md's parameter-mapping table SHALL be
  cross-checked field-by-field against BOTH (a) the connected `mcp__blockrun__blockrun_<name>` tool's
  declared JSON-schema parameters (already available in this session — no tool call needed to read a
  schema) and (b) the CLI's `src/args/<command>.ts` schema. Assert: every MCP-declared parameter has a
  named CLI-flag counterpart (or is explicitly flagged as a documented non-parity point per
  DOC-PARITY-002); this PROP does NOT execute either surface — it is a static schema diff, hence Tier 1
  despite covering "paid" commands.

### Tier 2 — live execution of README examples (real API, free-path preferred)

- **PROP-004** (DOC-README-007) — parse every fenced `bash`/`sh`/plain code block in README.md
  containing a `blockrun <cmd>` invocation; for each, extract the command name and every `--flag` token
  used; cross-check each flag against that command's captured real `--help` output (a static snapshot
  taken at doc-check time via `node dist/index.js <cmd> --help`, parsed for `--flag-name` tokens).
  Assert: every flag token used in an example is present in that command's real flag set; no unknown
  flag. This does NOT execute the commands (no network) — it is a static cross-reference against live
  `--help` output, hence Tier "2a" in spirit but classified with Tier 1 since it makes no network call
  itself (the `--help` capture is local/offline).
- **PROP-005** (DOC-README-008) — of the README's `--json` and `--help` examples, select ONE free-path
  `--json` example (e.g. `models --json`, `dex --json`, or `price --category crypto --action price
  --symbol BTC-USD --json` — all $0 per VERIFICATION.md rows 2-4) and actually execute it against
  `node dist/index.js`, asserting exit code 0 and valid JSON on stdout (REQ-006). The `--help` example
  requires no network call and is checked in PROP-001/PROP-004's static pass. **Budget guard**: this
  PROP MUST use a free-cost command per VERIFICATION.md's $0 rows — it SHALL NOT spend from the sandbox
  wallet (remaining ≈$0.26 per VERIFICATION.md's End balance, insufficient headroom to justify any
  paid-path live-execution proof here; the 18/18 paid-path evidence already exists in VERIFICATION.md
  and is REUSED via PROP-012/014, not re-spent).
- **PROP-023** (DOC-PARITY-005, -005a; Tier 2, live, MCP-side spend on a SEPARATE wallet from the CLI
  sandbox) — for each of the 9 DUAL-LIVE-RUN-tier commands (`wallet`, `chat`, `models`, `dex`, `price`,
  `defi`, `markets`, `rpc`, `phone`), invoke the connected `mcp__blockrun__blockrun_<name>` tool AND the
  CLI's `<name> --json` with the same semantic input, and record both raw outputs plus a structural
  comparison in `PARITY.md`. FIVE of these nine are genuinely `$0` (`wallet` status, `chat` mode=free,
  `models`, `dex`, `price` crypto/fx/commodity) and were ALREADY exercised during spec-writing
  (2026-07-08, real calls, not simulated) with these results, which THIS PROP's Phase-3/4 execution
  SHALL reproduce/reconfirm rather than assume stale:
  - `dex`: byte-identical output both surfaces (pure DexScreener passthrough).
  - `price` (crypto BTC-USD): identical field set, live-value drift only (same `feedId`).
  - `chat` (mode=free): identical field set `{model_used, response}`, `model_used` VALUE differs
    (auto-picked free model varies) — matches `VERIFICATION.md` row #5's CLI-side shape.
  - `wallet` (status): STRUCTURAL DIFFERENCE — MCP flattens active-chain fields to top-level + adds
    `network`/`chainId`/`isNew`/`explorerUrl`/`explorerLabel` + nested `wallets:{base,solana}`; CLI
    exposes `base`/`solana` as top-level keys with no extra metadata. MUST be recorded as an explicit
    finding, not silently normalized.
  - `models` (category=chat): STRUCTURAL DIFFERENCE (snake_case nested `pricing:{input,output}` vs
    camelCase flat `inputPrice`/`outputPrice`, plus MCP-only `object`/`created` and CLI-only
    `available`/`type` fields) AND a COUNT DIFFERENCE (MCP 44 vs CLI 55 for the identical category
    filter). MUST be recorded verbatim (both counts) as a finding — this PROP does NOT require root
    -causing or fixing it (out of scope, `src/` is read-only per REQ-NG-001); it only requires HONEST
    recording (DOC-CONSTRAINT-002).
  The remaining 4 (`defi`, `markets`, `rpc`, `phone` numbers/list) are PAID ($0.001-$0.002 each) on the
  MCP-connected wallet. **Funding precondition (ALREADY CONFIRMED, 2026-07-08 live check):** this
  session's connected wallet reported Base `0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e` = `$0` and
  Solana `8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9` = `$0` (active chain: solana) via
  `mcp__blockrun__blockrun_wallet` action `status` — INSUFFICIENT to execute any of the 4 paid
  dual-live-run commands right now. Before attempting any of them, THIS PROP SHALL re-check that
  wallet's live balance (same `blockrun_wallet` status call); IF still insufficient, it SHALL either (a)
  request funding for that wallet (separate from, and NOT drawing on, the CLI sandbox's
  `/Users/anicca/blockrun-cli-e2e-home` wallet or its `0x810f...` funding source — a DIFFERENT wallet
  entirely), or (b) fall back to a SCHEMA-ONLY comparison for that specific command (per PROP-025's
  method) and record that fallback explicitly in `PARITY.md` — it SHALL NOT silently skip the
  comparison or fabricate a result. This PROP's spend is capped at ≈$0.002 × 4 = ≈$0.008 total if
  funding is available; it is $0 if the fallback path is used for all four.

### Tier 3 — URL resolution + fresh adversary apple-to-apple comparison

- **PROP-014** (DOC-PARITY-003) — parse PARITY.md's per-command cost figures and evidence references;
  parse VERIFICATION.md's 18-row ledger; assert every PARITY.md cost figure and evidence id/tx string
  for a given command exactly matches the corresponding VERIFICATION.md row's cost and evidence column.
  Cross-file consistency check, no network — classified Tier 3 per the team brief's tier definition
  (cross-referencing the evidence ledger), even though mechanically it runs offline.
- **PROP-018** (whole-feature) — a FRESH-context adversary instance (per project CLAUDE.md's model
  -assignment table: adversary = `claude-opus-4-8`, spawned with zero builder context) reads
  `blockrun-cli`'s README/CONTRIBUTING/CHANGELOG/LICENSE/package.json/PARITY.md side-by-side with
  `blockrun-mcp`'s equivalents (structural fidelity) AND against `blockrun-cli`'s own VERIFICATION.md/
  decisions.md/behavioral-spec.md (factual accuracy — no doc claim outruns what the CLI actually does).
  Produces a binary PASS/FAIL per artifact (6 artifacts: README, CHANGELOG, CONTRIBUTING, LICENSE,
  package.json, PARITY.md) with concrete findings. This is the ONE proof obligation no script fully
  automates — structural "apple-to-apple"-ness and honesty-of-claims are judgment calls, not regex.
  **Review-process note (per Dais's direct instruction):** the SOLE required review gate for this
  feature, at every phase, is a fresh-context Claude adversary instance (this PROP) — `codex-review`
  is NOT a required gate for any current or future phase of this feature. Earlier iterations of this
  spec cite `codex-review` findings (e.g. "spec-review codex it-1 FIND-001", "it-4 FIND-004-001")
  elsewhere in this document and in `behavioral-spec.md` — those citations are RETAINED verbatim as
  factual historical records of what was found and fixed during past spec-review rounds (removing them
  would erase real audit trail), but none of them constitute an ONGOING requirement to re-run
  `codex-review`. If a future phase's process happens to run `codex-review` anyway (e.g. as an
  informal second opinion), that is neither required nor forbidden by this architecture — it simply
  is not counted as a gate.
- **PROP-019** (general doc quality) — every `http(s)://` URL newly introduced by this feature's docs
  (the GitHub repo URL in `repository`/`homepage`/`bugs`, `https://x402.org`, and any BlockRun artifact
  URL PARITY.md quotes from VERIFICATION.md) is resolved with an HTTP request; each SHALL return 200,
  OR (for the GitHub repo URL specifically, if the repo has not yet been pushed/made public at doc-check
  time) the check SHALL record the non-200 status explicitly in the check output as a KNOWN, documented
  gap rather than silently passing — never a silent false-positive PASS on a dead link.
- **PROP-020** (DOC-EVID-001, -002, -002a, -004; Tier 2, live, **spend-capable, required — no
  partial-pass**) — MUST produce full non-truncated URLs for **ALL THREE** of `image`/`video`/`music`;
  this PROP is NOT satisfied by obtaining fewer than three (spec-review codex it-1 FIND-001: an
  earlier draft let a "skip music, log a gap" path count as compliant — that path is REMOVED).
  Procedure (mechanically executable end-to-end — no out-of-band judgment, per spec-review codex it-2
  FIND-001-UNRESOLVED-TOPUP / FIND-002-UNRESOLVED-PREFLIGHT-PARSE):
  1. **Live balance preflight** (DOC-EVID-002): run the EXACT command `HOME=/Users/anicca/
     blockrun-cli-e2e-home node dist/index.js wallet --action status --json` and parse `.base.balance`
     from stdout (verified real shape:
     `{"activeChain":"base","base":{"address":"0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804","balance":<number|null>},"solana":{...}}`).
     A DIRECT run of this exact command on 2026-07-08 returned a numeric `0.264748`; TWO separate later
     runs during spec-review both returned `null` (most recently confirmed by spec-review codex it-4
     ADV-004-003 — `.base.balance` is `null` as of that check) — both outcomes are real, REPEATEDLY
     observed (consistent with `blockrun-mcp/README.md`'s documented Base-RPC-transient-outage
     behavior; `wallet --action status`'s own implementation, `src/shell/wallet.ts:234-255`'s
     `getBaseUsdcBalance()`, already tries 3 free public Base RPCs before giving up and returning
     `null`), so this step's output is EITHER a number OR `null`/nonzero-exit, never assumed to be a
     number, and hitting the `null` branch in a real run is LIKELY, not merely hypothetical. Do NOT
     trust `VERIFICATION.md`'s $0.264748 figure directly — it is a dated (2026-07-07) reference only,
     superseded by this live read.
  2. **Null/unavailable handling** (DOC-EVID-002a resolution order — assert this EXACT two-path chain;
     NO third, estimated/derived path — revised per spec-review codex it-4 FIND-004-001, which proved
     the previously-specified ledger-derived "conservative lower bound" was not actually conservative:
     `$0.59 − $0.316001 (recorded global.spent) = $0.273999`, HIGHER than `VERIFICATION.md`'s own
     recorded end balance `$0.264748` — an over-estimate, exactly the unsound-fallback risk FIND-004-001
     flagged): IF `.base.balance` is `null`/non-numeric/the process exits nonzero →
     (a) retry step 1 up to 3× with a 30s wait between attempts; IF a retry returns a number, use it;
     (b) STILL non-numeric after 3 retries → attempt the ON-CHAIN fallback via this EXACT invocation
     (independently re-derives the SAME `balanceOf` call `wallet --action status` already tries for
     free, but routed through BlockRun's PAID Tatum-backed gateway `/v1/rpc/base` instead of the 3 free
     public RPCs that already failed — a genuinely independent upstream, not a retry of the same
     thing):
     ```
     HOME=/Users/anicca/blockrun-cli-e2e-home node dist/index.js rpc --network base --method eth_call \
       --params '[{"to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","data":"0x70a08231000000000000000000000000a5cef4943c3f8f34e5138b5bcde6b88746a5c804"},"latest"]' \
       --json
     ```
     Contract address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` = the Base USDC address the CLI's
     own `src/shell/wallet.ts:25` (`USDC_ADDRESS`) already uses; calldata = the standard ERC-20
     `balanceOf(address)` selector `0x70a08231` + the sandbox wallet address left-zero-padded to 32
     bytes — the EXACT construction at `src/shell/wallet.ts:238`; decode the response's `result` hex
     as `Number(BigInt(result)) / 1e6` (6 decimals) — the EXACT logic already implemented as
     `parseBaseUsdcCallResult()` at `src/shell/wallet.ts:229-232`. Cost: $0.002
     (`RPC_PRICE_USD`, `src/args/rpc.ts:9`) — attempted UNCONDITIONALLY (no prior-balance gate is
     needed: if the wallet cannot afford $0.002, the underlying x402 settlement fails cleanly as a
     payment-rejection error rather than a false success, per the CLI's own existing REQ-220/REQ-221
     money-safety property, so this attempt is itself safe); IF the response yields a valid decoded
     number, use it; (c) IF the on-chain fallback in (b) ALSO fails (nonzero exit, malformed/missing
     `result`, or a payment-rejection error) → STOP the entire PROP-020 run and report failure
     IMMEDIATELY. `~/.blockrun/cli-budget.json`'s `global.spent` and the $0.59 funding amount MAY be
     written to the evidence output as a REFERENCE/cross-check figure ONLY (proven not to be a safe
     lower bound, per this step's opening note) — NEVER as a basis to proceed with any spend when (a)
     and (b) have both failed. Assert: no re-run, top-up, or ANY further spend is ever attempted
     against an unresolved (both-paths-failed) balance.
  3. Execute a FRESH re-run of each command WITH `--json` (required so `cost_usd` can be read from
     stdout, cross-checked against the `~/.blockrun/cli-budget.json` `global.spent` delta before/after
     — a mismatch between the two is itself treated as an indeterminate-balance case, re-entering step
     2) against the same sandbox HOME, in cost order **image (≈$0.015) → video
     (`--duration-seconds 1 --resolution 360p`, ≈$0.0525) → music (≈$0.1575)**, re-running step 1's
     preflight before each step.
  4. **Top-up loop** (DOC-EVID-002a, mechanically executable): WHEN the resolved balance before a step
     is insufficient for that step's real cost, STOP before attempting it; the ORCHESTRATOR (whoever
     holds the `0x810f6d61f7606deee2657d3083e150a222bc29c5` signing key — this send is OUTSIDE the CLI
     process, which has no send-funds command) sends `shortfall + $0.05` (where `shortfall =
     next-step-cost − resolved-balance`) to the sandbox Base wallet
     (`0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804`) via the same funding route documented in
     `execution-notes.md`'s "E2E 資金" section; the tx hash is recorded to
     `.vcsdd/features/blockrun-cli-docs/evidence/topup-<n>.json`; step 1's preflight is re-run up to 3×
     with a 2-minute wait (10-minute total budget) to confirm the top-up landed; on confirmation, RESUME
     from the stopped step; on send failure OR non-confirmation within the 10-minute budget, STOP and
     report failure (never fabricate a result). Repeat the whole top-up cycle as many times as needed.
  5. Assert (this PROP FAILS if any of these is false): a full non-truncated URL is captured for
     `image` AND `video` AND `music` (all three, not "each obtained" — no silent partial result); for
     each artifact, an evidence record at `.vcsdd/features/blockrun-cli-docs/evidence/
     {image,video,music}.json` contains the full URL, MD5, byte size, and real settled `cost_usd` — PLUS
     a settlement-proof field that DIFFERS BY COMMAND (verified against real source, DOC-EVID-004): for
     `video`/`music`, the `txHash` field from their `--json` output (populated from the
     `X-Payment-Receipt` header via `src/shell/manual-x402.ts`) MUST be present; for `image` (whose
     verified real success payload is `{ url, prompt, model, cost_usd }` with NO `txHash` field ANYWHERE
     — confirmed at `src/commands/image.ts:83-84` — this PROP does NOT require one), the settlement
     proof is `cost_usd` from `image`'s own `--json` output CROSS-CHECKED against the
     `cli-budget.json` `global.spent` delta recorded around that re-run.
- **PROP-021** (DOC-EVID-003; Tier 3, live network) — for each full URL PROP-020 obtained, issue an
  HTTP request and assert a 200 (or equivalent successful) status. Depends on PROP-020's output; SHALL
  NOT run against the OLD truncated URLs (those are unresolvable by construction).
- **PROP-022** (DOC-EVID-004, -005; Tier 1, cross-file) — assert: (a) `PARITY.md`'s `image`/`video`/
  `music` rows reference the corresponding `.vcsdd/features/blockrun-cli-docs/evidence/` file path and
  quote the same MD5 recorded there; (b) `VERIFICATION.md`'s rows #13/#15/#16 (or a dated appendix)
  contain the SAME full URL as the matching `evidence/` record — zero divergence between the three
  documents (VERIFICATION.md, PARITY.md, evidence/) for these three artifacts.

---

## 3. Budget guard

**Two separate wallets, two separate budgets — never netted against each other:**

**(A) CLI sandbox wallet** (`/Users/anicca/blockrun-cli-e2e-home`, per `VERIFICATION.md`): end balance
**$0.264748 USDC as of 2026-07-07** — this is a DATED figure, an approximate expectation only, NOT the
authoritative input for spend decisions (see PROP-020 step 1's live preflight requirement, added per
spec-review codex it-1 FIND-002). Budget cap $10 (goal), used ≈3.25% as of that same date.

**(B) MCP-connected wallet** (this Claude Code session's own connected `mcp__blockrun__*` tools,
entirely separate from (A)): checked live 2026-07-08 via `mcp__blockrun__blockrun_wallet` status — Base
`0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e` = **$0**, Solana
`8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9` = **$0** (active chain: solana). No funds currently
available for PROP-023's 4 paid dual-live-run commands (defi/markets/rpc/phone, ≈$0.008 total if all
four run) — PROP-023 itself specifies the funding-check-or-fallback behavior (DOC-PARITY-005a).

Of the five network-touching proof obligations (PROP-005, 019, 020, 021, 023 — §1's Purity boundary
table), TWO carry a REAL spend surface, each against its OWN separate wallet (tightened per spec-review
codex it-2 ADV-001-SPEND-SURFACE-WORDING for PROP-005/020, extended here for PROP-023 per Dais's
dual-live-run instruction):

- **PROP-005** — network-touching but NOT a real-spend proof obligation: constrained to a free-path
  (`$0`) command.
- **PROP-023** — real spend against wallet (B), the MCP-connected wallet: up to ≈$0.008 total (4 ×
  ≈$0.002) IF that wallet is funded before Phase 3/4 executes; $0 (schema-only fallback for the 4 paid
  members) if it is not. This spend is entirely independent of PROP-020's sandbox budget below — do NOT
  combine the two headroom calculations.
- **PROP-020** — a real-spend proof obligation against wallet (A), the CLI sandbox: REQUIRED to spend
  real USDC for ALL THREE of image/video/music (full-URL recovery is
  confirmed impossible per the §6a precheck, so this is not optional, and it is NOT partially
  satisfiable — see PROP-020's corrected assertion, spec-review codex it-1 FIND-001): estimated ≈$0.015
  (image) + ≈$0.0525 (video) + ≈$0.1575 (music) ≈ **$0.225 media total**, PLUS a possible ≈$0.002 PER
  ATTEMPT contingency from the on-chain `eth_call` balance-fallback (step 2 of PROP-020's procedure,
  DOC-EVID-002a) — the fallback fires on EVERY step whose preflight returns `null` (spec-review codex
  it-4 ADV-004-003 confirms `.base.balance` is CURRENTLY observed as `null`, and DOC-EVID-002's note
  above states this branch is likely to be hit repeatedly, not a rare edge case) — so the REALISTIC
  worst-case contingency is up to 3× $0.002 ≈ $0.006 (one fallback attempt per media step, cheapest
  -first sequencing), making the FULL worst-case total ≈$0.231, against a balance LAST OBSERVED at
  ≈$0.2647 (2026-07-07, itself unverified as current — see below) — **≈$0.034 estimated headroom**
  (tightened per spec-review codex it-4 ADV-004-001, which flagged the prior ≈$0.04 figure for
  omitting this contingency), to be reconfirmed by PROP-020's own live preflight before any spend.
  THE MONEY-SAFETY MECHANISM IS THE TOP-UP LOOP, NOT A SKIP AND NOT A DERIVED-BALANCE ESTIMATE: if the
  RESOLVED balance (live preflight number OR the on-chain fallback number — NEVER a
  `cli-budget.json`-derived estimate, which spec-review codex it-4 FIND-004-001 proved is not
  conservative: `$0.59 − $0.316001 = $0.273999`, HIGHER than the real recorded end balance
  `$0.264748`) is insufficient for the next cheapest-first step, PROP-020 STOPS before that step,
  triggers a wallet top-up from `0x810f6d61f7606deee2657d3083e150a222bc29c5` to the sandbox Base wallet
  (same funding route as the original E2E setup), re-confirms via a fresh live preflight, and RESUMES
  — repeated until all three artifacts are obtained. If BOTH the live preflight AND the on-chain
  fallback fail to resolve a balance, PROP-020 STOPS and reports failure — no top-up decision or spend
  is ever authorized by a derived/estimated number. No PROP in this architecture may overspend the
  sandbox wallet to force a PASS, AND no PROP may report a PASS with fewer than all three media
  artifacts obtained.

The 18/18 paid-path evidence this feature otherwise relies on (PROP-012/013/014/018's cross-checks) is
REUSED from the CLI feature's existing `VERIFICATION.md` for all commands EXCEPT the three full-URL
re-runs above. Any spend beyond PROP-020's ≈$0.225 (e.g. a retry after an upstream 502, mirroring
VERIFICATION.md row #17's documented retry, or an additional top-up cycle) MUST re-check the LIVE
balance (never the dated `VERIFICATION.md` figure) before firing — not assumed permitted by this
architecture.

---

## 4. Traceability summary

| DOC-* group | REQ count | Covering PROP(s) |
|---|---|---|
| README (DOC-README-001..013, -003a) | 14 | PROP-001, 002, 003, 004, 005, 006, 010 (badge/license link), 012 (contrib/license links folded into PROP-001 ordering); -003a (Claude-Code-primary-reader framing) covered qualitatively by PROP-018's structural-fidelity review, no mechanical PROP |
| CHANGELOG (DOC-CHANGELOG-001..003) | 3 | PROP-007 |
| CONTRIBUTING (DOC-CONTRIB-001..006) | 6 | PROP-008, 009 |
| LICENSE (DOC-LICENSE-001..002) | 2 | PROP-010 |
| package.json (DOC-PKG-001..007) | 7 | PROP-011 |
| PARITY.md (DOC-PARITY-001..003, -004, -005, -005a, -006, -007) | 8 | PROP-012, 013, 014, 023, 024, 025 |
| execution-notes.md (DOC-NOTES-001) | 1 | PROP-015 |
| Cross-cutting (DOC-CONSTRAINT-001..003, -001a) | 4 | PROP-016, 016b, 017, 003 (reused), and PROP-004's flag-fidelity check covers DOC-CONSTRAINT-003 |
| Media artifact full-URL evidence (DOC-EVID-001, -002, -002a, -003, -004, -005) | 6 | PROP-020, 021, 022 |
| Whole-feature judgment | — | PROP-018, 019 |

**Total: 51 unique `DOC-*` requirement IDs, 26 PROPs** (14+3+6+2+7+8+1+4+6 = 51 — mechanically
recounted after adding DOC-README-003a, DOC-PARITY-004/005/005a/006/007 per Dais's Claude-Code-centric
apple-to-apple verification instruction, and DOC-CONSTRAINT-001a (the version-literal narrow
exception, with its PROP-016b line-level check) per Dais's Phase 3/4 `--version` mismatch fix
instruction; confirmed NO `DOC-NG-*` IDs exist anywhere in `behavioral-spec.md`, per the earlier
spec-review codex it-2 FIND-NEW-002-TRACEABILITY-COUNT fix, still holding). This feature's own 4
non-goals
(`REQ-NG-001..004`, `behavioral-spec.md` §0 "Non-goals") are a SEPARATE clause type — constraints on
what this feature does NOT do, distinct from this docs-feature's own `DOC-*` requirement set — and are
NOT counted in this total; they are enforced by PROP-003's forbidden-term checks and
DOC-CONSTRAINT-001's src/test/dist-untouched guarantee rather than by a dedicated PROP each. (One of
those non-goals, REQ-NG-002, itself cross-references a DIFFERENT document's `REQ-NG-006` — the CLI
feature's own `behavioral-spec.md`, at `.vcsdd/features/blockrun-cli/specs/`, a separate file with its
own separate REQ-NG numbering — not this docs-feature's.) No `DOC-*` REQ is uncovered; several REQs
share a PROP where one mechanical check proves multiple requirements at once (e.g. PROP-001's
heading-order check proves DOC-README-001/002/013 together).
