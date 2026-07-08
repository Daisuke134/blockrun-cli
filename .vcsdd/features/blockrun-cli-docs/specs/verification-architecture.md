# blockrun-cli-docs — Verification Architecture

Feature: `blockrun-cli-docs` · Mode: lean · Phase 1b

Maps `specs/behavioral-spec.md`'s DOC-* requirements to proof obligations (PROP-*). Docs are static
artifacts — most checks are Tier-1 (mechanical, no network, no spend). Only PROP-005 (live example
execution) and PROP-019 (URL resolution) touch the network; PROP-005 is the ONLY proof obligation with
any spend surface, and it is scoped to free-path commands only (see §3, Budget guard).

Kept intentionally lean: 22 PROPs covering the 47 DOC-* requirements in behavioral-spec.md by grouping
requirements that share one mechanical check (e.g. "18 rows present," "these 6 env vars and no others")
into a single PROP rather than one PROP per REQ — no padding.

---

## 1. Purity boundary

| Layer | Nature | Examples |
|---|---|---|
| Pure | Docs-check script's parsing/comparison logic (markdown section extraction, JSON field diff, table-row counting, forbidden-term grep) | `scripts/docs-check.*` internals |
| Impure (network) | Live command execution against the real BlockRun API (PROP-005); HTTP HEAD/GET for URL resolution (PROP-019) | `--json`/`--help` example runs; github.com / x402.org reachability |
| Impure (filesystem, no network) | Reading repo files, `git diff` against this feature's commit range, `git log --tags` | PROP-016 |
| Out of scope entirely | Anything under `src/`, `test/`, `dist/` — this feature reads them (to verify docs match real `--help` output) but never writes them (REQ-NG-001 / DOC-CONSTRAINT-001) | n/a |

The docs-check script (Tier 1, PROP-001/002/003/006/007/008/009/010/011/012/013/015/016/017) SHALL be a
single executable (`scripts/docs-check.ts` or `.sh`, Phase 2's choice) that takes no network access and
exits nonzero on any failing check, printing which PROP failed — this is the Red/Green artifact for
Phase 2a/2b of THIS feature (not the CLI's own 408-test suite, which is untouched per REQ-NG-001).

---

## 2. Proof obligations

### Tier 1 — automated docs-check script (no network, no spend)

- **PROP-001** (DOC-README-001, -002, -013) — README.md exists; its `##`-level headings appear in the
  exact order: Install → Prerequisites → Fund your wallet → Commands → (examples, any heading) →
  Environment Variables → Multi-agent budget delegation → Troubleshooting → How it works →
  Contributing → License. Assert: ordered substring match of heading list against required sequence.
- **PROP-002** (DOC-README-006) — README's `## Commands` table has exactly 18 data rows, and the set of
  command names in column 1 equals the set of 18 real subcommand names parsed from `node dist/index.js
  --help`'s `Commands:` block (excluding the auto-generated `help [command]` row). Assert: set equality,
  count === 18.
- **PROP-003** (DOC-README-002, -009, -010, -011; DOC-NG-002, -004) — README.md does NOT contain (case
  -insensitive): `"model-context-protocol"`, `"claude mcp add"`, `"tool profiles"`, `"spawn npx enoent"`,
  `"coming soon"`, `"tbd"`, `"planned"`. Assert: zero matches for each forbidden string.
- **PROP-006** (DOC-README-009) — README's Environment Variables table's Variable/File column set
  equals exactly `{BLOCKRUN_BUDGET_LIMIT, ~/.blockrun/.session, ~/.blockrun/.chain,
  ~/.blockrun/payment-chain, ~/.blockrun/.solana-session, SOLANA_WALLET_KEY}` and does NOT contain
  `BLOCKRUN_API_BASE_URL` or `BLOCKRUN_HOME`. Assert: set equality + explicit absence check.
- **PROP-007** (DOC-CHANGELOG-001, -002, -003) — CHANGELOG.md exists; first non-blank line matches the
  preamble pattern; exactly one line matches `^## 1\.0\.0$`; no other `^## \d` heading exists unless a
  matching tag is found via `git log --tags --format=%D`; every bullet under `## 1.0.0` matches
  `^- \*\*.+ — .+\.\*\*`. Assert: regex counts and format match.
- **PROP-008** (DOC-CONTRIB-001, -002, -003) — CONTRIBUTING.md exists; contains the literal strings
  `npm install`, `npm run typecheck`, `npm run build`, `npm run dev`, `npm test`, `npm run test:e2e`
  (verbatim from `package.json` `scripts` keys — parsed from package.json, not hardcoded in the check,
  so a future script rename can't silently desync); does NOT contain `"SKILL.md"` or the standalone word
  `"skill"` (case-insensitive) outside a code fence quoting this very constraint. Assert: substring
  presence/absence.
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
- **PROP-016** (DOC-CONSTRAINT-001, DOC-NG-001) — `git diff <feature-start-commit>..HEAD --name-only`
  contains ONLY paths matching one of: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`,
  `package.json`, `PARITY.md`, `execution-notes.md`, `scripts/docs-check.*`,
  `.vcsdd/features/blockrun-cli-docs/**`. Assert: every changed path matches the allow-list; zero paths
  under `src/`, `test/`, `dist/`.
- **PROP-017** (DOC-CONSTRAINT-002) — every produced doc file (README/CHANGELOG/CONTRIBUTING/LICENSE/
  PARITY.md) is free of the forbidden-placeholder set from PROP-003, re-checked across ALL files (PROP
  -003 is README-only; this PROP covers the rest). Assert: zero matches across the file set minus
  README.md (already covered).

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
- **PROP-019** (general doc quality) — every `http(s)://` URL newly introduced by this feature's docs
  (the GitHub repo URL in `repository`/`homepage`/`bugs`, `https://x402.org`, and any BlockRun artifact
  URL PARITY.md quotes from VERIFICATION.md) is resolved with an HTTP request; each SHALL return 200,
  OR (for the GitHub repo URL specifically, if the repo has not yet been pushed/made public at doc-check
  time) the check SHALL record the non-200 status explicitly in the check output as a KNOWN, documented
  gap rather than silently passing — never a silent false-positive PASS on a dead link.
- **PROP-020** (DOC-EVID-001, -002; Tier 2, live, **spend-capable**) — for each of `image`/`video`/
  `music`, since full-URL recovery from existing evidence was already attempted and confirmed
  impossible (behavioral-spec.md §6a precheck finding: `git log --all -p -- VERIFICATION.md` has no
  full media URL; `cost_log.jsonl` logs only `endpoint`+`cost_usd`, no artifact URL), execute a FRESH
  re-run of that command's cheapest real path against sandbox HOME
  `/Users/anicca/blockrun-cli-e2e-home`, in cost order **image (≈$0.015) → video
  (`--duration-seconds 1 --resolution 360p`, ≈$0.0525) → music (≈$0.1575)**, checking the running
  cumulative spend against the remaining balance (≈$0.2647 per VERIFICATION.md's End balance) before
  each step; STOP before any step whose real 402 quote (not just the flat estimate) would exceed the
  remaining balance. Assert: a full non-truncated URL is captured for every artifact actually
  obtained; the downloaded bytes' MD5 + byte size are computed and written to
  `.vcsdd/features/blockrun-cli-docs/evidence/{image,video,music}.json` (or equivalent per-artifact
  file), each record including the full URL, MD5, byte size, real settled cost, and a
  tx/settlement reference from the fresh run's own output.
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

Sandbox wallet state per `VERIFICATION.md`: end balance **$0.264748 USDC**, budget cap $10 (goal), used
≈3.25% so far. TWO proof obligations in this architecture are spend-capable:

- **PROP-005** — constrained to a free-path (`$0`) command; no real spend.
- **PROP-020** — REQUIRED to spend real USDC (full-URL recovery is confirmed impossible per the §6a
  precheck, so this is not optional): ≈$0.015 (image) + ≈$0.0525 (video) + ≈$0.1575 (music) ≈ **$0.225
  total**, against a remaining balance of ≈$0.2647 — **≈$0.04 headroom**. PROP-020's own ordering rule
  (cheapest-first, stop-before-overspend) is the enforcement mechanism; this paragraph is the budget
  ceiling that rule serves. If the real settled cost of image+video together already leaves less than
  ≈$0.16 remaining, the `music` re-run (the most expensive leg) SHALL be skipped and logged as a gap in
  the evidence record (DOC-EVID-004's evidence file for `music` SHALL state "skipped — insufficient
  remaining balance, needs top-up" rather than fabricating a result) — no PROP in this architecture may
  overspend the sandbox wallet to force a PASS.

The 18/18 paid-path evidence this feature otherwise relies on (PROP-012/013/014/018's cross-checks) is
REUSED from the CLI feature's existing `VERIFICATION.md` for all commands EXCEPT the three full-URL
re-runs above. Any spend beyond PROP-020's ≈$0.225 (e.g. a retry after an upstream 502, mirroring
VERIFICATION.md row #17's documented retry) MUST re-check remaining balance before firing — not assumed
permitted by this architecture.

---

## 4. Traceability summary

| DOC-* group | REQ count | Covering PROP(s) |
|---|---|---|
| README (DOC-README-001..013) | 13 | PROP-001, 002, 003, 004, 005, 006, 010 (badge/license link), 012 (contrib/license links folded into PROP-001 ordering) |
| CHANGELOG (DOC-CHANGELOG-001..003) | 3 | PROP-007 |
| CONTRIBUTING (DOC-CONTRIB-001..006) | 6 | PROP-008, 009 |
| LICENSE (DOC-LICENSE-001..002) | 2 | PROP-010 |
| package.json (DOC-PKG-001..007) | 7 | PROP-011 |
| PARITY.md (DOC-PARITY-001..003) | 3 | PROP-012, 013, 014 |
| execution-notes.md (DOC-NOTES-001) | 1 | PROP-015 |
| Cross-cutting (DOC-CONSTRAINT-001..003, DOC-NG-001..004) | 7 | PROP-016, 017, 003 (reused), and PROP-004's flag-fidelity check covers DOC-CONSTRAINT-003 |
| Media artifact full-URL evidence (DOC-EVID-001..005) | 5 | PROP-020, 021, 022 |
| Whole-feature judgment | — | PROP-018, 019 |

**Total: 47 DOC-* requirements, 22 PROPs.** No REQ is uncovered; several REQs share a PROP where one
mechanical check proves multiple requirements at once (e.g. PROP-001's heading-order check proves
DOC-README-001/002/013 together).
