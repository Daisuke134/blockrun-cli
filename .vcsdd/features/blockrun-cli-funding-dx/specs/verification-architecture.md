# blockrun-cli-funding-dx — Verification Architecture

## 1. Tier model (same convention as blockrun-cli-agent-dx)

| Tier | Definition |
|---|---|
| Tier 1 | Pure/mocked — `node:test` unit/integration tests, `payOnce()`/`openUrl()`/ledger mocked via `mock.module()` |
| Tier 2 | Live binary execution — real `dist/index.js`, real `blockrun.ai` gateway where cheap/free |

This feature's ONE live network surface (`payOnce()` against `/v1/onramp/token`) is **$0 by construction**
(REQ-FUND-003/017) — every Tier 2 PROP below is free, no funding required, no spend risk.

---

## Tier 1 — pure/mocked

- **PROP-FUND-001** (REQ-FUND-001, -002, -004, -005, -009; Tier 1, mocked `src/shell/manual-x402.js`) — a
  unit/integration test mocks `payOnce()` to resolve `{ data: { url: "https://pay.coinbase.com/abc123" },
  billedUsd: null }` and invokes the REAL `commands/wallet.js`'s `run({ action: "deposit" }, ...)` on a
  Base-active mock wallet. Asserts: `exitCode === 0`; JSON output has `url ===
  "https://pay.coinbase.com/abc123"`, `opened === false` (no `--open` passed), AND the EXISTING `chain`/
  `address`/`note` fields are still present with their pre-existing meaning (REQ-FUND-004's backward
  -compat clause). ALSO asserts the mock's captured call args match REQ-FUND-001 EXACTLY: `endpoint ===
  "/v1/onramp/token"`, `body === { address: <the base address>, network: "base", asset: "USDC" }`.
- **PROP-FUND-002** (REQ-FUND-005, -008; Tier 1, mocked `payOnce()` + `src/shell/qr.js`'s `openUrl()`) —
  same successful-mint mock as PROP-FUND-001, PLUS a mock `openUrl()` returning `true`. Invokes `run(...)`
  with `open: true`. Asserts `opened === true` AND the mocked `openUrl()` was called with EXACTLY the
  minted URL. A SECOND case mocks `openUrl()` returning `false` (open attempted but failed) — asserts
  `opened === false` even though `--open` was passed (REQ-FUND-005's "AND `openUrl()` reports success"
  clause). A THIRD case omits `open` entirely — asserts `openUrl()` is NEVER called at all (the mock's own
  call-count is 0) — this is the REQ-FUND-008 default-OFF proof, not just an inferred field value.
- **PROP-FUND-003** (REQ-FUND-002, -006; Tier 1, mocked) — mocks `payOnce()` to resolve `{ data: { url:
  "https://evil.example.com/not-coinbase" } }` (a well-formed response that FAILS the URL-shape check).
  Asserts: `exitCode === 0` (NOT a failure — REQ-FUND-006's "never fail" contract), `url` is ABSENT from
  the JSON output, `note` mentions the mint could not be completed, and `chain`/`address` are still the
  pre-existing values.
- **PROP-FUND-004** (REQ-FUND-006; Tier 1, mocked) — mocks `payOnce()` to REJECT (throw), simulating a
  real network/gateway failure. Asserts the SAME "never fail" contract as PROP-FUND-003: `exitCode === 0`,
  `url` absent, `note` explains the failure, `chain`/`address` present.
- **PROP-FUND-005** (REQ-FUND-007, -007b; Tier 1, mocked) — TWO cases: (a) the wallet's currently-active
  chain IS Solana (`getChain()` mocked to `"solana"`) — asserts `payOnce()` is NEVER called (mock
  call-count 0 — proving REQ-FUND-007's "SHALL NOT attempt the mint AT ALL", not merely "the mint result
  is discarded"), `url`/`opened` ABSENT, `exitCode === 0`, `note` mentions the Base-only limitation; (b)
  REQ-FUND-007b's correction proof — the active chain IS Base but a `--chain solana` flag is ALSO passed
  alongside `--action deposit` — asserts the flag has NO EFFECT: `payOnce()` IS called (a Base mint still
  happens), proving `deposit` reads only `getChain()`, never a `--chain` override (caught live during
  Red-phase test-writing: `deposit`, unlike the `chain` action, never referenced a `--chain` flag at all
  in the pre-existing implementation — this spec's earlier draft incorrectly assumed it did).
- **PROP-FUND-006** (REQ-FUND-003, -017's mocked complement; Tier 1, mocked) — using PROP-FUND-001's
  successful-mint mock, asserts the `BudgetState` object passed into `run()` has `spent === 0` and
  `calls === 0` BOTH before and after the call (the SAME REQ-107 "wallet never touches the ephemeral
  budget" proof `test/integration/wallet.test.ts` already has for the other 8 actions, extended to
  `deposit`'s NEW mint path specifically).
- **PROP-FUND-007** (REQ-FUND-010, REQ-FUND-NG-004; Tier 1, mechanical grep-in-test-harness — same style
  as `blockrun-cli-agent-dx`'s PROP-DX-014) — a test reads the SOURCE TEXT of `src/commands/{image,video,
  music,speech,realface}.ts` and asserts NONE of them import or call anything resembling an
  auto-mint-on-payment-failure helper (i.e., none call `payOnce(` a SECOND time inside their `catch`
  block, and none import a function whose name matches `/topUp|onramp|deposit/i` from `manual-x402.js` or
  a new onramp-specific module) — a static regression guard against silently reintroducing blockrun-mcp's
  `launchTopUp()`-on-failure pattern in a future edit.
- **PROP-FUND-008** (REQ-FUND-011, -012, -013; Tier 1, new + regression) — TWO parts, both required:
  1. **New assertions**: `formatError("API error 402: insufficient balance")` (Base, default chain) DOES
     match the new card-funding hint (e.g. `/blockrun wallet --action deposit/`); the SAME message with
     `{ chain: "solana" }` DOES NOT match it.
  2. **Regression (mechanical, not just "trust the old suite")**: EVERY existing payment-error assertion
     in `test/unit/errors.test.ts` is re-run UNCHANGED (this file itself is not edited) and confirmed
     still green — proving REQ-FUND-012's "verified, not assumed" claim empirically, in addition to full
     `npm test` passing (REQ-FUND-018).
- **PROP-FUND-009** (REQ-FUND-009; Tier 1, mocked) — table-driven: for each of the 3 output classes
  (Base success, Base mint-failure, Solana), the NON-`--json` human text output contains the
  chain/address/URL/opened information appropriate to that class (e.g. Base success's human text contains
  the literal minted URL string; Solana's does not claim a URL exists).

## Tier 2 — live binary execution (real `dist/index.js`, real `blockrun.ai` gateway, $0 by construction)

- **PROP-FUND-010** (REQ-FUND-001, -002, -003, -017; Tier 2, live, $0) — `HOME=<fresh sandbox> node
  dist/index.js wallet --action deposit --json` (Base-default, fresh HOME) — asserts: exit 0; JSON `url`
  starts with `https://pay.coinbase.com/`; a follow-up `HEAD` request (Node's own `fetch(url, {method:
  "HEAD"})`, NOT completing any purchase flow) to that URL returns a `2xx` or `3xx` status (proving the
  minted link is a REAL, resolvable Coinbase Onramp URL, not just a well-formed-looking string); AND
  `~/.blockrun/cli-budget.json`'s `spent`/`calls` counters are IDENTICAL before/after (REQ-FUND-017's
  live money-safety proof — the SAME before/after-ledger pattern `blockrun-cli-agent-dx`'s PROP-DX-008
  already established).
- **PROP-FUND-011** (REQ-FUND-007; Tier 2, live) — same sandbox, `wallet --action chain --chain solana`
  (switch), then `wallet --action deposit --json` — asserts exit 0, `url` ABSENT from the JSON output,
  `note` mentions Base-only, and (money-safety) the ledger is unchanged.
- **PROP-FUND-012** (REQ-FUND-008; Tier 2, live, BEST-EFFORT/conditional — same class of environment
  -dependent caveat `blockrun-cli-agent-dx`'s PROP-DX-009 already documented for live RPC checks) —
  `wallet --action deposit --open --json` on a fresh sandbox: asserts `opened` is a boolean (`true` OR
  `false` depending on whether THIS session's OS actually has a browser opener available — a CI/headless
  runner may legitimately report `false` even on success, since `src/shell/qr.js`'s `openUrl()` already
  degrades gracefully) — the DETERMINISTIC assertion is `exitCode === 0` regardless of `opened`'s value,
  proving `--open` never causes a hard failure even when no GUI is present.
- **PROP-FUND-013** (README/PARITY reflection, REQ-FUND-014..016; Tier 1 mechanical, reusing the SAME
  style `blockrun-cli-docs`'s `scripts/docs-check.mjs` and `blockrun-cli-agent-dx`'s own additive checks
  already established): assert README.md's `## Fund your wallet` section mentions `--action deposit` and
  `--open`; assert PARITY.md's `wallet` section contains all 3 non-parity bullets from REQ-FUND-015
  (`onramp_url`/`url` rename, `--open`-gating, no-auto-mint-on-failure) as substrings.
- **PROP-FUND-014** (REQ-FUND-003, -017; Tier 1, mocked — added per impl-review it1 IMPL-FUND-1) — proves
  the `onQuote` zero-cap guard actually runs and actually aborts, not merely that the field is present in
  the call args: mocks `payOnce()` so that its OWN implementation invokes the REAL `onQuote` callback
  `deposit` passed it (simulating exactly what the REAL `probeAndSign()` does) with a NON-ZERO quoted
  amount (e.g. `0.5`) BEFORE ever resolving with mint data. Asserts: the mock's data (a would-be-real URL)
  is NEVER surfaced in the output (`url` absent from the JSON), `exitCode === 0` (REQ-FUND-006's graceful
  -degradation path, not `fail()`), and `note` explains the abort. A SECOND case passes a genuinely `$0`
  /`null` quote to the SAME `onQuote` callback and asserts the mint proceeds normally (`url` present) —
  proving the guard is a real ZERO-only gate, not an unconditional abort.

---

## 2. Budget guard

This feature introduces NO new required spend. PROP-FUND-010/011/012 are network-touching but $0 by
construction (REQ-FUND-003/017 — the onramp-token endpoint's own quoted amount is $0, verified live
during spec-writing per `onramp.ts`'s documented behavior), verified mechanically by the before/after
`cli-budget.json` unchanged check PROP-FUND-010 itself performs. If Phase 2/3 discovers a need for ANY
paid live call not covered here, it MUST be logged as a new proof obligation with an explicit cost
estimate before execution — not assumed permitted by this architecture.

---

## 3. Traceability summary

28 REQs (20 numbered + 5 non-goals + this section's own 3 cross-cutting REQs already counted above) map
to 13 PROPs (9 Tier 1 + 4 Tier 2). Every REQ in behavioral-spec.md §1-§4 has at least one PROP above
citing it; REQ-FUND-018 (regression) and REQ-FUND-020 (new-test-per-REQ) are cross-cutting and satisfied
by the PROP set as a whole plus the ongoing `npm test` gate, not a single dedicated PROP.
