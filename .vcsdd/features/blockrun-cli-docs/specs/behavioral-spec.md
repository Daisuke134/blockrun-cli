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
  top-level section order as `blockrun-mcp/README.md`, adapted from MCP-server framing to CLI framing:
  title + badges → one-line pitch → install → prerequisites → fund-your-wallet → Commands table →
  usage examples → environment variables → multi-agent budget delegation → troubleshooting →
  how-it-works (x402) → contributing → license.
- DOC-README-002: THE title/badge block SHALL include an MIT license badge (mirrors `blockrun-mcp`'s
  `[![License: MIT](...)](LICENSE)`) and MAY omit the npm-version badge unless/until the package is
  published to npm (REQ-NG-003).
- DOC-README-003: THE install section SHALL document BOTH: (a) running via a locally built clone
  (`git clone` → `npm install` → `npm run build` → `node dist/index.js <command>`, since `npm publish`
  is out of scope per REQ-NG-003), AND (b) the `npx`-equivalent form the package.json `bin` field makes
  possible once installed globally (`npm install -g .` then `blockrun <command>`), clearly labeled as
  local-install paths (not a published-registry `npx blockrun@latest` claim, which would violate
  REQ-NG-004 since the package is not published).
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
  real per the CLI's `decisions.md`/`behavioral-spec.md`: `BLOCKRUN_BUDGET_LIMIT` (persisted-ledger
  seed, REQ-019a), `~/.blockrun/.session`, `~/.blockrun/.chain` / `~/.blockrun/payment-chain`,
  `~/.blockrun/.solana-session`, `SOLANA_WALLET_KEY` — mirroring `blockrun-mcp/README.md`'s
  "Environment Variables" table structure (Variable/File | Default | Effect columns) with the CLI's
  OWN variable set, not a verbatim copy of the MCP server's table. `BLOCKRUN_API_BASE_URL` (the
  test-only override from `decisions.md` §11) SHALL NOT appear (explicitly excluded from the CLI's own
  spec, REQ-017's sibling constraint applied via decisions.md §11: "NOT documented in the CLI's README
  as a supported override").
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
  `micropayments`, `ai` (already present) PLUS entries paralleling `blockrun-mcp`'s keyword set adapted
  to CLI framing (e.g. `crypto`, `wallet`) — SHALL NOT include `mcp`, `model-context-protocol`, or
  `claude` (this package is not an MCP server; including those keywords would misrepresent it on an
  npm/GitHub search, violating REQ-NG-004's "no unimplemented feature" spirit).
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

- DOC-PARITY-001: `/Users/anicca/blockrun-cli/PARITY.md` SHALL exist as a new file mapping all 18 CLI
  commands to their corresponding `blockrun-mcp` tool, one row/section per command, each stating: the
  MCP tool name (`blockrun_<name>`), the CLI command (`blockrun <name>`), the parameter-mapping rule
  (1:1 field names per REQ-022/REQ-003 of the CLI's own spec, noting any CLI-only additive flag such as
  `--budget-limit` or `video`'s `--max-quote-usd`), and a live-run evidence pointer (the matching row
  number in `VERIFICATION.md`'s 18-command ledger, or a fresh command output if a gap is found).
- DOC-PARITY-002: `PARITY.md` SHALL explicitly flag any INTENTIONAL non-parity point already recorded
  in the CLI's own spec/decisions (e.g. `--budget-limit`/persisted ledger being CLI-only per decisions
  §8-9, `--max-quote-usd` being CLI-only per decisions §11, tool *profiles* being out of scope per
  REQ-NG-006) rather than silently omitting them, so an external verifier can distinguish "different
  by design" from "missing."
- DOC-PARITY-003: `PARITY.md` SHALL be internally consistent with `VERIFICATION.md` — every cost figure
  and evidence reference in `PARITY.md` SHALL match the corresponding row in `VERIFICATION.md` exactly
  (same command, same cost, same evidence id/tx), verified mechanically (Tier-1 automated check, see
  verification-architecture.md).

---

## 6a. Media artifact full-URL evidence (image / music / video)

Precheck finding (confirmed by direct inspection, not assumed): `VERIFICATION.md`'s rows #13
(`image`), #15 (`music`), #16 (`video`) record TRUNCATED artifact URLs (pattern
`…/<short-id>-….<ext>`). A full-URL recovery attempt was made and FAILED — `git log --all -p --
VERIFICATION.md` contains no full media URL, the e2e sandbox HOME
(`/Users/anicca/blockrun-cli-e2e-home/.blockrun/cost_log.jsonl`) logs only `endpoint`+`cost_usd`
(no artifact URL), and no other log under `.vcsdd/` retains one. Recovery is therefore NOT possible
for any of the three; a fresh re-run is REQUIRED for all three artifacts.

- DOC-EVID-001: THE FEATURE SHALL obtain the FULL, non-truncated hosted URL for each of the three
  media artifacts (`image`, `music`, `video`) via a FRESH re-run of that exact command at its
  cheapest real path, against the SAME sandbox HOME (`/Users/anicca/blockrun-cli-e2e-home`) used by
  the original `VERIFICATION.md` E2E pass — since recovery from existing evidence is confirmed
  impossible (see precheck finding above): `image` (same model class, ≈$0.015), `video`
  (`--duration-seconds 1 --resolution 360p`, ≈$0.0525, mirroring `VERIFICATION.md` row #16's exact
  invocation), `music` (default model, ≈$0.1575).
- DOC-EVID-002: BEFORE executing any fresh re-run under DOC-EVID-001, THE combined additional spend
  for all three artifacts (≈$0.015 + $0.0525 + $0.1575 = ≈$0.225) SHALL be checked against the
  sandbox wallet's remaining balance (≈$0.2647 USDC per `VERIFICATION.md`'s End balance) — it fits
  with ≈$0.04 headroom, but if the actual quoted/settled cost of any individual re-run exceeds its
  estimate (real 402 quote can differ from the flat estimate, per the CLI's own REQ-021), re-runs
  SHALL proceed cheapest-first (image → video → music) and SHALL STOP before any re-run whose real
  quote would push cumulative spend past the remaining balance, rather than overspending.
- DOC-EVID-003: EVERY full URL obtained per DOC-EVID-001 SHALL be verified to resolve with an HTTP
  200 (or equivalent successful) status — a live network check (Tier 3, see
  verification-architecture.md).
- DOC-EVID-004: THE downloaded artifact bytes (or, at minimum, its MD5 checksum and byte size) SHALL
  be saved under `.vcsdd/features/blockrun-cli-docs/evidence/` — one evidence record per artifact
  (`image`, `music`, `video`) — and `PARITY.md`'s rows for these three commands SHALL reference these
  evidence files (path + MD5) as their evidence pointer, extending (not replacing) DOC-PARITY-001's
  general VERIFICATION.md-row reference for those three commands specifically.
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
