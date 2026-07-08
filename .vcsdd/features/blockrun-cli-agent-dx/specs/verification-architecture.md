# blockrun-cli-agent-dx — Verification Architecture

Feature: `blockrun-cli-agent-dx` · Mode: lean · Phase 1b

Maps `specs/behavioral-spec.md`'s REQ-DX-* requirements to proof obligations (PROP-DX-*). Per Dais's
instruction: **Tier 1 = tests** (unit/integration, run via `npm test`), **Tier 2 = live binary
execution** (spawning the real built `dist/index.js`, asserting on real stdout/exit codes). This
feature is a `src/` implementation feature, NOT a docs feature — the CLI's own EXISTING 408-test suite
(`npm test`) is the primary regression gate throughout, and every new REQ gets a NEW test in the SAME
suite (REQ-DX-041), not a separate check script.

---

## 1. Purity boundary

| Layer | Nature | Examples |
|---|---|---|
| Pure | `introspectSchema()` (zod → flag-metadata), `classifyError()` (message pattern → `code`), `costModel` derivation, kebab-case flag-name conversion | New pure functions under `src/core/` or `src/args/` (Phase 2 decides exact file) |
| Impure (network, no spend) | Live `blockrun commands [--json]` execution (no wallet call, REQ-DX-001) | PROP-DX-002/003 |
| Impure (network, real spend — REUSED sandbox, no NEW spend by this feature) | Live `wallet --action status --json` against the existing funded sandbox HOME (`/Users/anicca/blockrun-cli-e2e-home`, ≈$0.03 balance per the `blockrun-cli-docs` feature's Phase 3/4 evidence) — a FREE call, no spend, but exercised against a REAL environment for PROP-DX-009's conditional check | PROP-DX-009 |
| Impure (mocked SDK, Tier 1) | Unit tests stubbing a REAL command's underlying network call (not calling any classifier directly) to force `network_error`/`all_rpcs_failed`/`solana_client_error` deterministically, exercising the REAL catch-block path end-to-end | PROP-DX-006 (network_error, real catch-block path per spec-review it-1 SPEC-DX-2), PROP-DX-010 (balance-null reasons) |
| Out of scope entirely | Money-path internals (`checkBudget`/`reserveBudget`/x402 signing) — READ for grounding, never modified in behavior (REQ-DX-NG-001) | n/a |

---

## 2. Proof obligations

### Tier 1 — new unit/integration tests (`npm test`, no network)

- **PROP-DX-001** (REQ-DX-003, -004, -DX-NG-004) — a NEW pure function `introspectSchema(schema):
  FlagMeta[]` (Phase 2 names/locates it under `src/core/` or `src/args/shared.ts`) is table-driven
  tested against ALL 18 real `schema` exports from `src/args/*.ts` (imported directly in the test, not
  copied) — for EACH schema, the test asserts the introspector's output exactly matches a
  hand-verified expected `FlagMeta[]` for THAT ONE schema (captured from the schema's real `.shape` at
  test-write time, per this spec's own confirmed zod `4.4.3` API surface: `field.isOptional()`,
  unwrapped `_def.type`, `ZodEnum.options`, `ZodDefault._def.defaultValue`). Assert: 18/18 schemas
  produce the correct flag count, names (kebab-case), types, `required`, `enum`, and `default` values.
  **Anti-drift note**: this PROP proves the introspector is CORRECT today; it does not itself prove a
  FUTURE schema change can't drift the catalog — that guarantee comes from REQ-DX-007's design (the
  introspector reads the real `.shape` at runtime, never a copy) rather than from any single test. A
  code-review check (informal, at PR time) that `blockrun commands`'s implementation actually calls
  `introspectSchema(schema)` per command (not a hardcoded array) is the practical enforcement of
  REQ-DX-NG-004, alongside this PROP.
- **PROP-DX-004** (REQ-DX-003's `costModel`) — table-driven test: for each of the 18 commands, derive
  `costModel` via the SAME `gatePaidCall`-presence signal this spec grounds REQ-DX-003 in, and assert
  it matches the REAL, already-verified ground truth: `wallet`/`models`/`dex` → `"free"`; the other 15
  → `"paid"` (mirrors the `grep -c gatePaidCall src/commands/*.ts` counts captured in behavioral-spec.md
  REQ-DX-001). Phase 2's actual derivation mechanism (a small generated registry, or a literal
  per-command annotation cross-checked against this same grep at build time) is free to choose, but
  MUST match this table.
- **PROP-DX-005** (REQ-DX-011's classification, REQ-DX-012's exit-code mapping) — unit tests, one per
  `code` value, each feeding a REAL, spec-cited message string through the (new) classification
  function and asserting the correct `code` + exit-code pair:
  - `"usage_error"` / exit 2 — e.g. `src/args/rpc.ts`'s real `"--network is required"` message.
  - `"budget_exceeded"` / exit 2 — e.g. `src/core/budget.ts`'s real
    `` `Global budget limit $5.00 would be exceeded (...)` `` message shape.
  - `"quote_exceeded"` / exit 3 — e.g. `src/commands/video.ts`'s real
    `` `Quote $0.06 exceeds --max-quote-usd $0.05 — aborting before signing.` `` message shape, AND
    `src/commands/shared.ts`'s `"Budget cap would be exceeded by the real quoted price."`.
  - `"upstream_error"` / exit 4 — a message matching `isModelUnavailable` (e.g. `"not found or not
    active"`) and a SEPARATE case matching `isServerError` (e.g. contains `"500"`) — checked BEFORE
    `insufficient_funds` below, per REQ-DX-011/016's corrected priority order (matching
    `formatError()`'s REAL `if`/`else if`/`else if` chain).
  - `"insufficient_funds"` / exit 3 — a message matching `formatError()`'s existing `isPaymentError`
    branch (e.g. contains `"402"` or `"insufficient balance"`) AND does NOT ALSO match
    `isModelUnavailable`/`isServerError` (a priority-conflict case, e.g. a message containing BOTH
    `"balance"` and `"not found or not active"`, MUST classify as `upstream_error`, never
    `insufficient_funds` — this exact conflict case is REQUIRED, not optional, since it is the precise
    scenario spec-review it-1 SPEC-DX-3 flagged as previously unspecified).
  - `"network_error"` / exit 4 — see PROP-DX-006 below (requires simulating the actual Node `fetch`
    failure shape reaching a REAL command's catch block, not just feeding a string to the classifier
    directly).
  - **No-code fallback** / exit 1 — a message matching NONE of the above patterns SHALL classify with
    `code` OMITTED and exit code `1`, exactly like today's universal behavior — asserted by a test
    feeding a generic, unrelated error message through the classifier.
- **PROP-DX-006** (REQ-DX-011's `network_error`, REQ-DX-015; Tier 1, MOCKED — REWRITTEN per
  spec-review it-1 SPEC-DX-2, which found the ORIGINAL version of this PROP would false-positive: a
  test that constructs a raw `TypeError('fetch failed', {cause})` and calls a classification function
  DIRECTLY proves nothing about whether that raw error can EVER reach the classifier from a real
  command, since all 18 commands' catch blocks call `extractErrorMessage(err)` FIRST, which — before
  REQ-DX-015's fix — silently discards `err.cause` and `err.name` entirely):
  1. Pick ONE real command whose network call this test can cheaply stub (Phase 2's choice, e.g.
     `defi` — it makes exactly one `getWithPaymentRaw()` call after validation/budget-gate pass).
  2. Stub ONLY that command's underlying network call (the SDK client method or the raw `fetch`,
     whichever this command actually uses) to REJECT with the REAL, live-verified Node shape:
     `Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("..."), { code:
     "ENOTFOUND" }) })` for the connection-failure case, and separately a rejection matching
     `isTimeoutError()`'s real detection (e.g. an error named `"TimeoutError"`, per REQ-DX-011 item
     6's live-corrected finding that `AbortSignal.timeout()` produces `"TimeoutError"`, NOT
     `"AbortError"`) for the timeout case.
  3. Invoke that command's REAL `run(flags, opts, budget)` function (or spawn the built binary — Tier
     1 favors the in-process `run()` call for speed) with valid flags, and assert the ACTUAL
     `CommandOutcome` it returns (`fail()`'s real output) — NOT a direct classifier call — has
     `exitCode === 4` and (parsing `outcome.stdout` as JSON when `opts.json` is true) `code ===
     "network_error"`.
  4. **RED-phase requirement**: THIS EXACT TEST, run against today's pre-fix code (before REQ-DX-015's
     `extractErrorMessage()` extension exists), SHALL FAIL — because `extractErrorMessage()` currently
     collapses the stubbed error to the bare string `"fetch failed"` with no cause/name information,
     so no classifier operating on that string alone can ever produce `"network_error"`. This test
     passing is therefore genuine evidence the REQ-DX-015 wiring works end-to-end, not merely that an
     isolated classifier function is internally correct.
  This canNOT be a live Tier-2 test (there is no reliable way to force a real DNS/connection failure
  against the live BlockRun API on demand) — mocking Node's own live-verified `fetch()` failure shape,
  routed through the REAL command function, is the grounded, deterministic, end-to-end alternative.
- **PROP-DX-007** (REQ-DX-014) — a single shared classification function is called from EVERY ONE of
  the 18 `commands/<name>.ts` error paths (not reimplemented per-command) — verified by a
  source-inspection test (import each `commands/*.ts` module and assert, via its exported `fail`
  call-sites or a lighter-weight static grep-in-test-harness check, that no command has its OWN
  parallel classification logic). Exact mechanism left to Phase 2, but the PROP itself requires
  proving "one function, 18 call sites," not "18 independent copies that happen to agree today."
- **PROP-DX-010** (REQ-DX-021, -022, -023) — Tier 1, MOCKED: unit tests force
  `getBaseUsdcBalance`/`getSolanaUsdcBalance`-equivalent code paths to their real null-producing state
  (all 3 Base RPC fetches rejected/return unparseable data; the Solana client's `getBalance()` throws)
  and assert `balanceUnavailableReason` is EXACTLY `"all_rpcs_failed"` / `"solana_client_error"`
  respectively, in BOTH the `status` action's per-chain shape (REQ-DX-020) and the `chain` action's
  `activeBalance` shape (REQ-DX-023). A THIRD case asserts that when the mock returns a real numeric
  balance (including exactly `0`), `balanceUnavailableReason` is ABSENT from the output entirely (not
  `null`, not an empty string — the KEY genuinely absent, per REQ-DX-020's "never present alongside a
  real numeric balance" rule).
- **PROP-DX-011** (REQ-DX-040) — the EXISTING 408-test suite passes in full, run via `npm test`, at
  every checkpoint of this feature's Green phase (not just once at the end) — this is the ongoing
  regression gate, not a one-time check.
- **PROP-DX-013** (REQ-DX-015, -016; Tier 1, new — added per spec-review it-1 SPEC-DX-3) — TWO
  distinct assertions, both required:
  1. **Extraction correctness**: `formatError()`'s NEW order-preserving helper (REQ-DX-016, e.g.
     `classifyKnownError`) is unit-tested directly with table-driven cases covering all 4 outcomes
     (`"model_unavailable"`, `"server_error"`, `"payment_error"`, `null`) AND the priority-conflict
     case (a message matching BOTH `isModelUnavailable` and `isPaymentError` patterns MUST return
     `"model_unavailable"`, matching `formatError()`'s real branch order) — asserted against the EXACT
     same branch-order `formatError()` itself uses (import and re-check `formatError()`'s OWN output
     for the SAME conflict-case message to prove the two never disagree, not just that the new
     function looks right in isolation).
  2. **Non-conflation**: a test asserts the NEW `classifyKnownError`-style function and the EXISTING
     `isPaymentRejectionError` (`src/core/errors.ts:31-34`) are DIFFERENT functions with DIFFERENT
     pattern sets — feeding a message containing bare `"payment"` (no `"402"`, no `"balance"`, no
     `"insufficient"`, no `"rejected"`) SHALL classify as a payment-error case via the NEW function
     (matching `formatError()`'s `isPaymentError`'s bare-`"payment"` check) but SHALL return `false`
     via the EXISTING `isPaymentRejectionError` (which has no bare-`"payment"` check) — proving Phase
     2 did not accidentally wire the new `code` classifier to the narrower, wrong, already-importable
     function.

### Tier 2 — live binary execution (real `dist/index.js`, real API where cheap/free)

- **PROP-DX-002** (REQ-DX-001, -002) — `HOME=/Users/anicca/blockrun-cli-e2e-home node dist/index.js
  commands --json` exits 0, produces valid JSON matching `{ commands: FlagMeta[] }` with EXACTLY 18
  entries whose `name` set equals the REAL 18 subcommand names (the SAME set already established by
  `node dist/index.js --help`'s `Commands:` block, cross-checked exactly as the prior `blockrun-cli
  -docs` feature's `docs-check.mjs` already does for PROP-002/012 there). Assert: no network call was
  made (this is checkable by running with a sandbox HOME that has a stale/zero-balance ledger and
  confirming `~/.blockrun/cli-budget.json`'s `spent`/`calls` counters are UNCHANGED before/after this
  invocation — the same money-safety verification pattern the docs feature's PROP-020 established for
  fresh media re-runs).
- **PROP-DX-003** (REQ-DX-005, -006) — `node dist/index.js commands` (no `--json`) exits 0, human
  table output has 18 rows (one per real command), and `node dist/index.js commands --help` exits 0
  with Commander's standard help format (no crash, no special-casing bug).
- **PROP-DX-008** (REQ-DX-010, -012 — a REAL, live-triggered usage_error/budget_exceeded, not mocked)
  — two live invocations against the built binary, both requiring NO network call and NO spend
  (money-safety preserved):
  1. `node dist/index.js rpc --network "../bad"` (a KNOWN-malformed network slug, per the EXISTING
     REQ-201 local-validation rule) → exit code 2, `--json` output's `code` is `"usage_error"`.
  2. `HOME=/Users/anicca/blockrun-cli-e2e-home node dist/index.js defi --path prices/coingecko:bitcoin
     --budget-limit 0.0000001 --json` (an ephemeral cap smaller than `defi`'s known $0.001 estimate,
     REQ-018's existing pre-call gate) → exit code 2, `code` is `"budget_exceeded"`, AND (money-safety
     check) `~/.blockrun/cli-budget.json`'s `spent`/`calls` UNCHANGED before/after (the local gate must
     reject BEFORE any network call, per the EXISTING REQ-020 behavior this feature does not change).
- **PROP-DX-009** (REQ-DX-020, -021, -022, -023) — `HOME=/Users/anicca/blockrun-cli-e2e-home node
  dist/index.js wallet --action status --json` against the REAL, currently-live sandbox — a
  CONDITIONAL live assertion (the real RPC outcome on any given day is not under this test's control,
  per the docs feature's own repeated observation that Base RPC calls sometimes return `null` and
  sometimes a real number): IF `base.balance` is `null`, THEN `base.balanceUnavailableReason` MUST
  equal `"all_rpcs_failed"`; IF it is a number, THEN `balanceUnavailableReason` MUST be ABSENT. Same
  conditional structure for `solana`. This live check complements PROP-DX-010's deterministic mocked
  version — PROP-DX-009 proves the real code path produces the invariant against the ACTUAL live RPC
  behavior (whichever way it lands that day), while PROP-DX-010 proves the EXACT reason string is
  correct when the failure is forced.
- **PROP-DX-012** (README/PARITY.md reflection, REQ-DX-030..034) — Tier 1 mechanical, reusing the SAME
  style of check the `blockrun-cli-docs` feature's `scripts/docs-check.mjs` already established
  (Phase 2 may extend that same script or add a small new one under `scripts/`): assert README.md's
  `## Commands` table has 19 rows (18 + `commands`) matching the REAL 19-command set (`--help`'s
  `Commands:` block now includes `commands`); assert README.md contains the 6 real `code` values +
  the `0/1/2/3/4` exit-code mapping, and does NOT contain any 7th invented code value; assert PARITY.md
  contains the new `commands`-has-no-MCP-equivalent bullet. This does NOT re-run the docs feature's
  full 18-PROP suite — it is a narrow, additive check for this feature's own README/PARITY.md deltas.

---

## 3. Budget guard

This feature introduces NO new required spend. PROP-DX-002/003 (the `commands` catalog) are
network-touching but zero-cost by construction (REQ-DX-001/REQ-DX-NG-005 — no wallet call at all).
PROP-DX-008's two live-triggered error cases are DESIGNED to reject locally before any network call
(that is the exact behavior under test), so they are $0 by construction, verified by the
before/after `cli-budget.json` unchanged check described in PROP-DX-008 itself. PROP-DX-009 makes ONE
free `wallet --action status --json` call against the EXISTING sandbox from the `blockrun-cli-docs`
feature — no new funding is required, and no spend occurs (`status` is a free action, REQ-107 of the
base CLI's own spec). If Phase 2/3 discovers a need for ANY paid live call not covered here, it MUST
be logged as a new proof obligation with an explicit cost estimate compared against the sandbox's
current balance (≈$0.03 per the docs feature's last recorded evidence) before execution — not assumed
permitted by this architecture.

---

## 4. Traceability summary

| REQ-DX-* group | REQ count | Covering PROP(s) |
|---|---|---|
| `blockrun commands` catalog (REQ-DX-001..008) | 8 | PROP-DX-001, 002, 003, 004 |
| Error codes + exit codes (REQ-DX-010..016) | 7 | PROP-DX-005, 006, 007, 011 (regression), 013 |
| Balance-unavailable reason (REQ-DX-020..024) | 5 | PROP-DX-009, 010 |
| Documentation reflection (REQ-DX-030..034) | 5 | PROP-DX-012 |
| Cross-cutting / regression (REQ-DX-040..041) | 2 | PROP-DX-011 (and implicitly every PROP above, each of which requires a real new test per REQ-DX-041) |
| Non-goals (REQ-DX-NG-001..005) | 5 (separate clause type, not counted in the REQ-DX total below) | Enforced structurally by every PROP's own money-path/shape-preservation assertions, not a dedicated PROP each |

**Total: 27 REQ-DX-* requirements (excluding the 5 non-goals, a separate clause type per the same
convention the `blockrun-cli-docs` feature established for its own `REQ-NG-*`), 13 PROP-DX-*** (8+7+5+5+2
= 27; REQ-DX-015/016 and PROP-DX-013 added per spec-review it-1's SPEC-DX-1/2/3 fixes). No
REQ-DX-* is uncovered; several REQs share a PROP where one mechanical/test check proves multiple
requirements at once (e.g. PROP-DX-002 proves REQ-DX-001 and REQ-DX-002 together).
