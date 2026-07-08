# Purity Boundary Audit — blockrun-cli-docs (Phase 5)

Feature: `blockrun-cli-docs` · Mode: lean · Phase: 5 · Date: 2026-07-08

Compares the boundary DECLARED in `specs/verification-architecture.md` §1 ("Purity boundary") against
what was ACTUALLY observed in the evidence (`evidence/*`), the real `git diff`, and the single narrow
`src/` exception, per this feature's own non-goal REQ-NG-001 ("this docs feature does not modify CLI
behavior").

## Declared Boundaries

From `specs/verification-architecture.md` §1:

| Layer | Nature | Declared examples |
|---|---|---|
| **Pure** | docs-check script's parsing/comparison logic (markdown section extraction, JSON field diff, table-row counting, forbidden-term grep); static MCP-tool-schema vs CLI-args-schema diff (PROP-025, no tool call) | `scripts/docs-check.*` internals |
| **Impure (network, no spend)** | Live command execution on a free-cost path (PROP-005); HTTP HEAD/GET for URL resolution (PROP-019, PROP-021) | `--json`/`--help` example runs; github.com/x402.org reachability; the 3 recovered media URLs |
| **Impure (network, real spend — CLI sandbox wallet)** | Live wallet-balance preflight + fresh media re-runs that DO spend real USDC (PROP-020) | image/video/music fresh re-runs against sandbox HOME (`/Users/anicca/blockrun-cli-e2e-home`) |
| **Impure (network, real spend — MCP-connected wallet, separate from the CLI sandbox)** | Dual invocation of connected `mcp__blockrun__blockrun_<name>` tool AND equivalent CLI command for 9 DUAL-LIVE-RUN commands; 4 of 9 are paid (PROP-023) | `blockrun_wallet`/`chat`/`models`/`dex`/`price` ($0) + `defi`/`markets`/`rpc`/`phone` (paid) |
| **Impure (filesystem, no network)** | Reading repo files, `git diff` against feature's commit range, `git log --tags` | PROP-016 |
| **Out of scope entirely** | Anything under `src/`, `test/`, `dist/` — read for cross-checking `--help` output, never written | n/a (REQ-NG-001/DOC-CONSTRAINT-001), EXCEPT one authorized line: DOC-CONSTRAINT-001a permits exactly one `.version("<semver>")` literal change in `src/index.ts` (PROP-016b enforces this at line granularity) |

The `.vcsdd/**` allow-list entry in PROP-016 (widened from the narrower per-feature path per Dais's
direct Phase 2b instruction) explicitly authorizes shared orchestrator bookkeeping files OUTSIDE this
feature's own directory (`.vcsdd/active-feature.txt`, `.vcsdd/history.jsonl`, `.vcsdd/index.json`) as an
unavoidable side effect of running `vcsdd` tooling at all — this is a declared, intentional boundary
widening, not a leak.

## Observed Boundaries

### 1. Filesystem scope (`git diff eadc61c..HEAD --name-only`)

Re-executed this session. Every changed path falls into one of:

- Docs artifacts: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `PARITY.md`,
  `VERIFICATION.md`, `execution-notes.md`, `package.json` — all on the PROP-016 allow-list, all within
  this feature's declared "docs are static artifacts" scope.
- This feature's own verification tooling: `scripts/docs-check.mjs`.
- This feature's own state/evidence tree: `.vcsdd/features/blockrun-cli-docs/**` (specs, reviews,
  state.json, evidence/*.json + *.log + *.md + the 3 fresh media binaries).
- Shared orchestrator bookkeeping OUTSIDE this feature's directory: `.vcsdd/history.jsonl`,
  `.vcsdd/index.json` — confirmed via `git diff eadc61c..HEAD -- .vcsdd/history.jsonl .vcsdd/index.json`
  to contain ONLY phase-transition/gate-recorded timestamp log lines and the `currentPhase`/`updatedAt`
  fields for `blockrun-cli-docs` itself. No other feature's state was touched, no docs content leaked
  into these files. Matches the declared `.vcsdd/**` widening exactly.
- `src/index.ts` — exactly one line changed (`git diff eadc61c..HEAD -- src/` re-executed this session:
  `1 file changed, 1 insertion(+), 1 deletion(-)`, diff body `-  .version("0.1.0"); / +
  .version("1.0.0");`). Matches DOC-CONSTRAINT-001a's narrow exception exactly — no other `src/` file,
  no second line in `index.ts`.

**No path under `test/` or `dist/` appears anywhere in the diff.** Zero deviation from the declared
"out of scope entirely" boundary for the CLI's own test/build output.

### 2. Network/spend scope (evidence/*.json)

`evidence/image.json`, `evidence/video.json`, `evidence/music.json` each record a real command execution
against the CLI sandbox HOME (`/Users/anicca/blockrun-cli-e2e-home`), a real settled `cost_usd`
($0.015/$0.052501/$0.1575), and — for video/music — a real `txHash`. `evidence/topup-mcp-1.json` and
`media-run-summary.json` record the MCP-connected-wallet top-up (`fundingTx`
`0xe41ec6c1...`, $0.005, from `0x810f`) used to fund PROP-023's paid dual-live-run commands, entirely
separate from the CLI sandbox wallet's own funding — consistent with the declared "two separate wallets,
never netted" budget guard in `verification-architecture.md` §3. Re-verified this session: all 3 media
URLs return HTTP 200, all 3 local artifact MD5s match the recorded values (see
`verification-report.md` §3) — the spend this feature declared as required actually happened and
produced verifiable, still-live artifacts, not a fabricated or stale record.

### 3. Pure-layer scope (docs-check script)

`scripts/docs-check.mjs`, re-executed this session (`node scripts/docs-check.mjs`, 18/18 PASS, exit 0),
performs only markdown/JSON/text parsing and comparison against locally-captured `--help` output and
repo files — no network call originates from the script itself (the one "network-touching" PROP it
encodes, PROP-005, is executed by the SEPARATE Phase 3/4 live-execution step, not by the Tier-1 script;
this matches the spec's own classification in §1's Impure-vs-Pure split).

## Summary

| Declared boundary | Observed | Match |
|---|---|---|
| Docs are static artifacts (README/CHANGELOG/CONTRIBUTING/LICENSE/package.json/PARITY.md/VERIFICATION.md/execution-notes.md) | Only these files + `scripts/docs-check.mjs` + feature's own `.vcsdd/` tree changed | ✅ |
| `src/`/`test/`/`dist/` untouched except one authorized version-literal line | `git diff -- src/` = exactly 1 line, matching `.version("1.0.0")`; zero `test/`/`dist/` paths anywhere | ✅ |
| `.vcsdd/**` widened allow-list covers orchestrator-shared bookkeeping | `.vcsdd/history.jsonl` + `.vcsdd/index.json` changes are pure phase-transition log/state entries for this feature only | ✅ |
| Impure network+spend confined to CLI sandbox wallet (PROP-020) and a separate MCP-connected wallet (PROP-023) | `evidence/{image,video,music}.json` (sandbox wallet, real spend, real settlement) + `evidence/topup-mcp-1.json` (MCP wallet, separate top-up) — never netted, matches §3's budget guard | ✅ |
| Pure layer = docs-check's own parsing logic, no network | `scripts/docs-check.mjs` re-run: 18/18 PASS, no network calls originate from the script | ✅ |

**Overall Phase 5 purity verdict: PASS — zero deviation between the declared boundary in
`verification-architecture.md` §1 and the actually-observed `git diff` scope, evidence records, and
`src/` exception.** The single narrow `src/index.ts` exception (PROP-016b) is the ONLY departure from
"docs are purely static," and it is explicitly declared, spec-authorized (DOC-CONSTRAINT-001a), and
verified at line granularity — not an unaccounted leak.
