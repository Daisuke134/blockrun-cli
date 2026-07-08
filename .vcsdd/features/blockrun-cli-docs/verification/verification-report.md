# blockrun-cli-docs — Verification Report (Phase 5, Formal Hardening)

Feature: `blockrun-cli-docs` · Mode: lean · Phase: 5 · Date: 2026-07-08

## Proof Obligations

`state.json`'s `proofObligations` array is empty (`[]`). This is correct for this feature, not an
omission: `blockrun-cli-docs` is a **docs/packaging** feature (README, CHANGELOG, CONTRIBUTING, LICENSE,
package.json, PARITY.md, execution-notes.md). Its proof surface, as designed in
`specs/verification-architecture.md` §2, is 26 PROP-* obligations already fully discharged across Phases
2-4:

- **Tier 1** (18 PROPs, mechanical, no network) — encoded as the executable `scripts/docs-check.mjs`
  checker, which IS this feature's Red/Green TDD artifact (not the CLI's own 408-test suite).
- **Tier 2/3** (8 PROPs, live network/spend/cross-file/adversary judgment) — discharged during Phase 3/4
  via real command execution, real HTTP checks, and a fresh-context adversary review (`reviews/impl/
  iteration-1`, verdict PASS, 4/4 dimensions).

There is no separate "formal proof obligation" registry for this feature because there is no pure
business logic to prove properties over (per `verification-architecture.md` §1's purity table: the only
Pure layer is the docs-check script's own parsing/comparison logic, which is exercised end-to-end by
running the script itself, not by a separate property-test harness). Per the harden protocol, this report
therefore re-executes the docs-feature EQUIVALENTS of proof-obligation execution — the Tier-1 mechanical
checker, the CLI's own regression suite (untouched-but-reverified per REQ-NG-001), and fresh live
re-verification of the three media evidence artifacts — and records the results below as this feature's
Phase 5 evidence.

## Re-executed Checks (this session, 2026-07-08)

### 1. `node scripts/docs-check.mjs` — expected 18/18 PASS, exit 0

```
[PASS] PROP-001: heading order matches required sequence
[PASS] PROP-002: 18/18 command rows present and match real subcommand set
[PASS] PROP-003: README.md free of forbidden placeholder/MCP-framing terms
[PASS] PROP-006: Environment Variables table has exactly 6 rows with the required member set, .chain/payment-chain separate
[PASS] PROP-007: CHANGELOG.md preamble/1.0.0-heading/bullet-format all correct
[PASS] PROP-008: CONTRIBUTING.md has all required script invocations, no banned skill-mechanism claims
[PASS] PROP-009: PR checklist contains all 6 required items
[PASS] PROP-010: LICENSE body matches blockrun-mcp/LICENSE; package.json.license === MIT
[PASS] PROP-011: all package.json fields correct
[PASS] PROP-012: PARITY.md has 18/18 sections, each naming both MCP tool and CLI form
[PASS] PROP-013: all 3 known intentional non-parity points called out
[PASS] PROP-015: execution-notes.md references 'blockrun-cli-docs' and today's date 2026-07-08
[PASS] PROP-016: all 46 changed path(s) within allow-list; zero test/dist touches; src/ touch (if any) limited to index.ts (line-level checked by PROP-016b)
[PASS] PROP-016b: src/ diff is exactly one line, matching the .version("...") release-literal exception
[PASS] PROP-017: CHANGELOG/CONTRIBUTING/LICENSE/PARITY.md free of forbidden placeholders
[PASS] PROP-022: PARITY.md, VERIFICATION.md, and evidence/*.json agree on full URL + MD5 for image/video/music
[PASS] PROP-024: 9 DUAL-LIVE-RUN + 9 SCHEMA-ONLY partition exactly matches spec
[PASS] PROP-025: every MCP-declared parameter for all 9 SCHEMA-ONLY commands is referenced in PARITY.md

18 checks run, 18 PASS, 0 FAIL
```

**Result: PASS — exit code 0, 18/18.** Matches expectation exactly.

### 2. `npm test` — expected 408/408

```
ℹ tests 408
ℹ suites 0
ℹ pass 408
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13603.980583
```

**Result: PASS — 408/408, 0 fail.** Confirms REQ-NG-001 (this docs feature never touched `src/` behavior
— the one authorized `src/index.ts` version-literal line does not affect any of the 408 assertions) —
this regression suite is bit-for-bit the same CLI behavior as before this feature started.

### 3. Fresh media URL re-verification (3/3 evidence records, `.vcsdd/features/blockrun-cli-docs/evidence/{image,video,music}.json`)

| Artifact | Full URL | HTTP status (re-checked now) | MD5 (recorded) | MD5 (re-hashed now) | Match |
|---|---|---|---|---|---|
| image | `https://blockrun.ai/api/media/media/images/2026/07/08/4c8b9423-36ff-4ee3-a0b9-316e8f2a0c1a.png` | 200 | `53a632611b24c2daa96c3b006bb6a862` | `53a632611b24c2daa96c3b006bb6a862` | ✅ |
| video | `https://blockrun.ai/api/media/media/videos/2026/07/08/4edd85de-72c0-94e5-a443-c45a429d07d3-7f749dcc.mp4` | 200 | `3785635d5f8140fe4eb632f9b053bc3f` | `3785635d5f8140fe4eb632f9b053bc3f` | ✅ |
| music | `https://blockrun.ai/api/media/media/audios/2026/07/08/47eac713-dfd8-4969-9444-175ff7b39459.mp3` | 200 | `2fc782959ce3d0279c053c0d0720cd86` | `2fc782959ce3d0279c053c0d0720cd86` | ✅ |

Commands used: `curl -s -o /dev/null -w "%{http_code}" "<url>"` for each of the 3 `fullUrl` values read
from `evidence/{image,video,music}.json`; `md5 .vcsdd/features/blockrun-cli-docs/evidence/{image,video,
music}-fresh.{png,mp4,mp3}` for the local artifacts, compared against the `md5` field recorded in each
JSON evidence file.

**Result: PASS — all 3 URLs return HTTP 200 (still live, not expired/deleted); all 3 local artifacts'
MD5 hashes are byte-identical to the values recorded at evidence-capture time (2026-07-08).** This
satisfies PROP-021 (URL resolution) and re-confirms PROP-020/022's evidence integrity with fresh,
independently-drawn evidence (not merely trusting the recorded JSON).

## Summary

| Check | Expected | Actual | Verdict |
|---|---|---|---|
| `node scripts/docs-check.mjs` | 18/18 PASS, exit 0 | 18/18 PASS, exit 0 | PASS |
| `npm test` | 408/408 | 408/408 | PASS |
| 3 fresh media URLs, HTTP re-check | 200/200/200 | 200/200/200 | PASS |
| 3 local artifact MD5 re-hash | match recorded | match recorded | PASS |
| `proofObligations` (state.json) | `[]` (docs feature — expected empty) | `[]` | as-designed |

**Overall Phase 5 proof-equivalent verdict: PASS.** All mechanical and live-evidence checks this feature
depends on were re-executed fresh in this session (not assumed from prior logs) and all passed. No
regression, no stale/expired evidence, no drift between the docs-check script's expectations and the
repo's actual state.
