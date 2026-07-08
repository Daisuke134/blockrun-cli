# Verification Report — blockrun-cli-agent-dx (Phase 5)

Feature: `blockrun-cli-agent-dx` · Mode: lean · Phase 5 (Formal Hardening)

## Proof Obligations

`state.json`'s `proofObligations` array is empty (`[]`) — this is a lean-mode feature that never
registered a discrete Phase-1b `proofObligations` list in `state.json`. The feature's REAL proof
surface, per `specs/verification-architecture.md` (14 PROP-DX-* obligations, Tier 1 = tests, Tier 2 =
live binary execution), is the 122 NEW/changed tests folded into this repo's single `npm test` suite
plus 3 real-binary spot checks. All 14 PROP-DX-* obligations (PROP-DX-001 through PROP-DX-014) are
exercised as part of the 532-test `npm test` run below — none were skipped, none deferred. This report
documents that 0-registered-obligations state and substitutes the executed proof surface in its place.

### Tier 1 — `npm test` (full regression + all new PROP-DX-* tests)

Command: `npm test`

```
tests 532
pass  532
fail  0
cancelled 0
skipped 0
todo 0
duration_ms 15859.365917
```

**Result: 532/532 PASS.** Matches the expected count (408 pre-existing regression tests from the
`blockrun-cli-docs` feature's baseline + 124 new/changed tests for this feature's 28 REQ-DX-*/14
PROP-DX-* work, net of consolidation — the sprint-2b state.json note records "530/530 tests" at Green
completion; the 2 additional tests present now come from `impl review it2`'s post-review fixes,
confirmed still 100% pass at Phase 5). No regressions in the existing suite.

### Tier 1 — `npm run typecheck`

Command: `npm run typecheck` (`tsc --noEmit`)

Output: clean — zero type errors, zero warnings.

### Tier 1 — `node scripts/docs-check.mjs` (PROP-DX-012, README/PARITY.md reflection)

```
18 checks run, 18 PASS, 0 FAIL
```

**Result: 18/18 PASS**, matching the expected count. Confirms PROP-DX-012's README/PARITY.md deltas
(19-row Commands table including `commands`, all 6 `code` values + 0/1/2/3/4 exit-code mapping, no 7th
invented code, PARITY.md's `commands`-has-no-MCP-equivalent bullet) are correctly reflected.

### Tier 2 — real-binary spot checks (dist rebuilt fresh via `npm run build` before running; 0 stale
files confirmed via `find src -name "*.ts" -newer dist/index.js` → 0 results)

**1. `node dist/index.js commands --json` (PROP-DX-002/003)**

```
exit=0
count=18
shape ok=true  (commands array present)
```

18 entries, matching the real 18 subcommand set. Exit 0.

**2. `node dist/index.js rpc --network "../bad" --method eth_blockNumber --json` (PROP-DX-008.1,
usage_error)**

```
exit=2
{"error":true,"code":"usage_error","message":"Error: Invalid network '../bad'. Use a chain slug like 'ethereum', 'base', or 'solana'."}
```

Matches expected: exit code 2, `code: "usage_error"`.

**3. `node dist/index.js defi --path prices/coingecko:bitcoin --budget-limit 0.0000001 --json`
(PROP-DX-008.2, budget_exceeded, money-safety)**

```
exit=2
{"error":true,"code":"budget_exceeded","message":"Error: Global budget limit $0.0000 would be exceeded ($0.0000 spent, $0.0000 remaining, next call estimated $0.0010). ..."}
```

Matches expected: exit code 2, `code: "budget_exceeded"`.

**Money-safety check**: `~/.blockrun/cli-budget.json` compared byte-for-byte before and after this
invocation via `diff` — **files identical** (`spent: 88.33458000000059`, `calls: 2997` unchanged). The
local budget gate rejected before any network call, exactly as PROP-DX-008 requires. No spend occurred.

## Summary

| Check | Expected | Actual | Verdict |
|---|---|---|---|
| `npm test` | 532/532 | 532/532 | PASS |
| `npm run typecheck` | 0 errors | 0 errors | PASS |
| `node scripts/docs-check.mjs` | 18/18 | 18/18 | PASS |
| `commands --json` count | 18 | 18 | PASS |
| `rpc --network "../bad"` | exit 2, usage_error | exit 2, usage_error | PASS |
| `defi --budget-limit 0.0000001` | exit 2, budget_exceeded, no spend | exit 2, budget_exceeded, budget file unchanged | PASS |

All Tier 1 and Tier 2 proof obligations from `specs/verification-architecture.md` (PROP-DX-001..014)
are covered by the executing test suite and the 3 live-binary spot checks above. `dist/` was rebuilt
immediately before the spot checks to guarantee freshness (0 files newer than `dist/index.js` confirmed
both before and after the rebuild). **Phase 5 proof-obligation verdict: PASS.**
