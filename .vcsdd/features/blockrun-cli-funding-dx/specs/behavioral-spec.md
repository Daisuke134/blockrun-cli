# blockrun-cli-funding-dx — Behavioral Specification (EARS)

Feature: `blockrun-cli-funding-dx` · Mode: lean · Language: TypeScript

Repo: `/Users/anicca/blockrun-cli`. This is a **`src/` implementation feature** closing improvement-review
gap P1-4: MCP's `blockrun_wallet action:"deposit"` (Coinbase Onramp card-purchase link) is ported to the
CLI's EXISTING `wallet --action deposit` action, which today only prints the active-chain address + a
generic note. Every requirement below is grounded in REAL source, read in full before writing this spec:

- `/private/tmp/claude-501/-Users-anicca-anicca-project/ec3606df-8de7-491a-8a92-7ee667020d6a/scratchpad/blockrun-mcp/src/utils/onramp.ts`
  — `mintOnrampUrl(address)` and `launchTopUp()`, read in full.
- `.../blockrun-mcp/src/tools/wallet.ts` — the `deposit` action's handler AND the tool's own description
  text (confirms "Paid tools auto-open this on an out-of-funds failure"), read in full.
- `.../blockrun-mcp/src/tools/video.ts` (representative of image/music/speech/realface, which `grep -rl
  launchTopUp src/tools/` also lists) — the `isPaymentRejectionError` catch branch that calls
  `launchTopUp()` automatically, read in full.
- `src/shell/manual-x402.ts` (this repo) — `payOnce()`/`payAndPoll()`/`probeAndSign()`, read in full. This
  is the CLI's OWN existing generic "submit → 402 → sign (SDK's createPaymentPayload, never hand
  -constructed) → resubmit" helper, already used by image/video/music/speech/realface.
- `src/shell/http.ts` (`fetchWithTimeout`), `src/shell/qr.ts` (`openUrl`, already implemented and used by
  nothing yet — ported from blockrun-mcp's `qr.ts` alongside `openQrInViewer` but never wired up), read in
  full.
- `src/args/wallet.ts`, `src/commands/wallet.ts` (today's `deposit` action — 5 lines, address+note only),
  `src/core/errors.ts` (`formatError()`'s payment-error branch), `test/unit/errors.test.ts` (every
  existing payment-error assertion), read in full.
- `src/core/cost-model.ts` (blockrun-cli-agent-dx) — `wallet`'s `costModel` is derived by grepping
  `src/commands/wallet.ts` for `gatePaidCall(` (currently 0 occurrences → `"free"`); this feature MUST
  NOT introduce a `gatePaidCall(` call into `wallet.ts`, or `blockrun commands --json`'s `wallet` entry
  would silently flip to `"paid"`.

Every requirement is a MUST. There are no optional/recommended items in this document.

---

## 0. Scope

### Key finding from reading the reference implementation (grounds several DELIBERATE deviations below)

`mintOnrampUrl(address)` is a plain two-step x402 flow — POST `https://blockrun.ai/api/v1/onramp/token`
with `{ address, network: "base", asset: "USDC" }`, expect a `402` challenge, sign a payment payload via
`@blockrun/llm`'s `createPaymentPayload`, re-POST with `PAYMENT-SIGNATURE`, read `{ url }` — **structurally
IDENTICAL** to `src/shell/manual-x402.ts`'s existing `payOnce()` (this repo's own generic
submit→402→sign→resubmit helper, already used by 4 other commands). No new dependency, no new env var, no
new low-level x402 code is needed — this feature is a `payOnce()` CALLER, not a new implementation of the
x402 mechanics (REQ-221's existing "never hand-construct an x402 payload" rule, already satisfied by
reusing `payOnce()`).

The quoted amount for this endpoint is **$0** — MCP's own `onramp.ts` comment states this explicitly: "the
x402 signature is used purely as wallet authentication... nothing settles... a user with an EMPTY wallet
can still mint a link." `payOnce()`'s existing `amountToUsd()`-derived `billedUsd` already returns `null`
for a `<= 0` amount (`src/core/budget.ts`'s `amountToUsd`), so this requires zero special-casing in the
shared helper — the deposit action simply never calls `gatePaidCall`, exactly like `wallet`'s other 8
actions today.

MCP's `launchTopUp()` is documented "NEVER throws — a mint/open failure degrades to a manual-funding note
so it's safe to call from a tool's error path." MCP's `src/tools/{image,video,music,speech,realface}.ts`
each call `launchTopUp()` AUTOMATICALLY inside their `isPaymentRejectionError` catch branch — minting AND
attempting to open a FRESH onramp link on every out-of-funds failure (confirmed live in this repo's own
`grep -rl launchTopUp src/tools/`: `image.ts`, `music.ts`, `realface.ts`, `speech.ts`, `video.ts`,
`wallet.ts`). This CLI DOES NOT mirror that auto-mint-on-every-failure behavior (REQ-FUND-010) — see the
non-goal and REQ-FUND-010's own rationale below.

### Non-goals (REQ-FUND-NG-*)

- REQ-FUND-NG-001: THIS FEATURE SHALL NOT implement a Solana equivalent of card-based onramp funding —
  ground truth: Coinbase Onramp is Base-only (`onramp.ts`'s own `if (chain !== "base")` guard); no Solana
  card-purchase mechanism exists anywhere in blockrun-mcp to port.
- REQ-FUND-NG-002: THIS FEATURE SHALL NOT change any `wallet` action's behavior OTHER than `deposit`
  (additively extended) and `formatError()`'s payment-error guidance text (additively extended,
  REQ-FUND-011) — every other action (`status`/`setup`/`qr`/`chain`/`budget`/`delegate`/`revoke`/`report`)
  is unchanged.
- REQ-FUND-NG-003: THIS FEATURE SHALL NOT add a `gatePaidCall`/budget-check call anywhere in
  `src/commands/wallet.ts` — `wallet`'s `costModel` (derived live by `blockrun-cli-agent-dx`'s
  `src/core/cost-model.ts` via a `gatePaidCall(` source grep) MUST remain `"free"`, unchanged, in
  `blockrun commands --json`'s catalog.
- REQ-FUND-NG-004: THIS FEATURE SHALL NOT auto-trigger an onramp mint from ANY of the 5 media commands'
  (`image`/`video`/`music`/`speech`/`realface`) payment-rejection error paths — see REQ-FUND-010's
  rationale for the deliberate deviation from blockrun-mcp's `launchTopUp()`-on-failure behavior.
- REQ-FUND-NG-005: THIS FEATURE SHALL NOT add any new runtime dependency — `payOnce()` (manual-x402.ts),
  `openUrl()` (shell/qr.ts), and `@blockrun/llm`'s `createPaymentPayload`/`parsePaymentRequired`/
  `extractPaymentDetails` are ALL already present in this repo and already used elsewhere.

---

## 1. `wallet --action deposit` — Coinbase Onramp card-purchase link (P1-4)

- REQ-FUND-001: `wallet --action deposit`, WHEN the CURRENTLY-ACTIVE chain (`getChain()`) is `"base"`,
  SHALL attempt to mint a one-time Coinbase Onramp URL by calling `src/shell/manual-x402.ts`'s EXISTING
  `payOnce()` — NOT a new hand-rolled x402 implementation — with:
  **Correction (caught live during Red-phase test-writing, not assumed)**: `deposit`, like the EXISTING
  `status` action, does NOT accept a `--chain` override for its OWN chain resolution — `getChain()` (the
  persisted/session-active chain) is the ONLY input. This spec's earlier draft incorrectly claimed
  "the `--chain` flag if given, else the currently-active chain, same resolution `status`/`chain` actions
  already use" — that is FALSE for `status` (which, read directly, never references any `--chain` flag
  at all) and is the `chain` ACTION's own distinct, side-effecting behavior (switching the persisted
  preference), not something `deposit` inherits. A `--chain` flag value passed alongside `--action
  deposit` has NO EFFECT on which chain `deposit` targets (REQ-FUND-007b makes this explicit).
  - `endpoint: "/v1/onramp/token"` (resolves, via `payOnce()`'s existing `apiBase()`, to
    `https://blockrun.ai/api/v1/onramp/token` — the EXACT literal `ONRAMP_ENDPOINT` blockrun-mcp's
    `onramp.ts` uses).
  - `body: { address, network: "base", asset: "USDC" }` (`address` = the Base wallet's address, per
    `onramp.ts`'s own request body shape).
  - `resourceDescription: "Mint a Coinbase Onramp link to fund this wallet"` (`onramp.ts`'s own fallback
    text, verbatim).
- REQ-FUND-002: ON a successful `payOnce()` response, THE SYSTEM SHALL validate that `data.url` is a
  string starting with `https://pay.coinbase.com/` — the SAME sanity check `onramp.ts`'s own
  `mintOnrampUrl()` performs (`!data.url.startsWith("https://pay.coinbase.com/")` → treated as failure). A
  response missing this shape is treated identically to a network/gateway failure (REQ-FUND-006).
- REQ-FUND-003: THE mint request in REQ-FUND-001 SHALL NOT call `gatePaidCall` or touch the ephemeral
  `BudgetState`/persisted `~/.blockrun/cli-budget.json` ledger in any way — ground truth: the endpoint is
  EXPECTED to quote $0 by design (`onramp.ts`'s own comment: "the x402 signature is used purely as
  wallet authentication... nothing settles"), and `wallet`'s OTHER 8 actions already never call
  `gatePaidCall` either (REQ-107, REQ-FUND-NG-003). **Correction (impl-review it1 IMPL-FUND-1)**: an
  "expected $0" server-side CLAIM is NOT itself a client-side enforcement mechanism —
  `manual-x402.ts`'s `probeAndSign()` signs WHATEVER amount the server's real 402 response quotes
  UNLESS the caller's `onQuote` callback aborts it first (the SAME mechanism `video`/`music`/`speech`/
  `realface` already use to reverify a real quote against a budget cap before signing, REQ-220 of the
  base CLI's own spec). THE mint request in REQ-FUND-001 SHALL therefore pass an `onQuote` callback that
  THROWS (aborting BEFORE `createPaymentPayload` is ever invoked, per `payOnce()`'s own documented
  contract) WHEN the quoted amount is a positive, non-null number — a genuine client-side zero-cap
  enforcement, not a trust-the-server assumption. A throw here is caught by REQ-FUND-006's existing
  graceful-degradation path (the abort reason folded into `note`), never `fail()`.
- REQ-FUND-004: `wallet --action deposit --json`'s output SHALL gain a NEW, OPTIONAL top-level `url`
  field — present ONLY when REQ-FUND-001's mint succeeds AND passes REQ-FUND-002's validation — alongside
  the EXISTING `chain`/`address`/`note` fields, which SHALL NOT change type or meaning (this action's
  CURRENT output shape, `{ chain, address, note }`, per `src/commands/wallet.ts`'s existing `deposit`
  branch, is preserved verbatim; `url` is purely additive). **Deliberate rename from blockrun-mcp**: MCP's
  `structuredContent` calls this field `onramp_url`; the CLI uses the shorter `url` — recorded as a
  PARITY.md non-parity bullet (REQ-FUND-014), not an oversight.
- REQ-FUND-005: `wallet --action deposit --json`'s output SHALL gain a NEW, OPTIONAL top-level `opened`
  boolean field — `true` ONLY when `--open` (REQ-FUND-008) was passed AND a URL was successfully minted
  AND `src/shell/qr.ts`'s EXISTING `openUrl()` (already implemented, currently unused — ported from
  blockrun-mcp's `qr.ts` alongside `openQrInViewer` but never wired to any command) reports success;
  `false` in every other case (mirrors MCP's own `opened: r.opened` field, same name, no rename).
- REQ-FUND-006: A mint failure at ANY step (network/timeout error, non-2xx/non-`402→signed-200` gateway
  response, or REQ-FUND-002's URL-shape validation failing) SHALL NOT cause `--action deposit` to
  fail/exit nonzero — ground truth: blockrun-mcp's `launchTopUp()` is explicitly documented "NEVER throws
  — a mint/open failure degrades to a manual-funding note so it's safe to call from a tool's error path."
  `--action deposit` instead DEGRADES to TODAY'S pre-existing `{ chain, address, note }` response (`url`
  omitted), with `note` appended to explain the link could not be generated (the underlying error message,
  same text `extractErrorMessage()` would have produced, folded into `note` — not thrown/surfaced via
  `fail()`).
- REQ-FUND-007: WHEN the CURRENTLY-ACTIVE chain (`getChain()`) is `"solana"`, `--action deposit` SHALL
  NOT attempt REQ-FUND-001's mint AT ALL — ground truth: `onramp.ts`'s own `if (chain !== "base") return
  {...}` guard, and Coinbase Onramp has no Solana/SPL-USDC support. Behavior is UNCHANGED from today's
  existing `deposit` action (`{ chain, address, note }`, no `url`/`opened` fields), except `note`'s text
  SHALL explain the Base-only limitation (mirroring `onramp.ts`'s own guidance text: card top-up is
  Base-only; switch chain with `--action chain --chain base`, or use `--action setup` for the Solana
  address/QR flow).
- REQ-FUND-007b: a `--chain solana` flag passed ALONGSIDE `--action deposit` SHALL HAVE NO EFFECT on
  which chain `deposit` targets — per REQ-FUND-001's correction, `deposit` reads ONLY `getChain()` (the
  currently-active chain), never a `--chain` override. (Switching the active chain, if desired, remains
  a SEPARATE, explicit `--action chain --chain solana` call, unchanged by this feature.)
  `--action setup` for the Solana address/QR flow).
- REQ-FUND-008: `wallet` SHALL gain a new `--open` boolean flag (scoped in effect to `--action deposit`;
  a no-op for every other action). WHEN passed AND a URL was successfully minted (REQ-FUND-001/002) on
  Base, THE SYSTEM SHALL attempt to open that URL in the OS default browser via `src/shell/qr.ts`'s
  EXISTING `openUrl()` (reused verbatim, REQ-FUND-NG-005). WHEN OMITTED (the DEFAULT), THE SYSTEM SHALL
  NOT open a browser — the URL is always printed/returned either way (REQ-FUND-004/009) so a human OR
  agent caller can act on it. **Deliberate deviation from blockrun-mcp**: MCP's `launchTopUp()`
  unconditionally attempts `openUrl()` with no opt-in flag, and MCP's own `blockrun_wallet` tool
  description states "Paid tools auto-open this on an out-of-funds failure" — this CLI's default-OFF,
  explicit-`--open`-required design is justified by the SAME class of reasoning REQ-016a already
  established in this codebase (the CLI's one-shot, agent-primary-caller process model does not share
  MCP's interactive-human-watching-a-live-session assumption; an agent-driven, often headless invocation
  should not spawn a GUI browser process as a silent side effect by default).
- REQ-FUND-009: THE NON-`--json` human `--action deposit` output text SHALL summarize the SAME
  information the `--json` fields carry: on a successful Base mint, the URL itself, whether it was opened
  (REQ-FUND-008), and the funding-address/settlement explanation (mirroring `onramp.ts`'s own human note
  text: "Buy USDC with a card — it settles into your Base wallet `<address>`. Single-use link, expires in
  a few minutes."); on Solana or a mint failure, the SAME degraded/Base-only text REQ-FUND-006/007
  describe.

---

## 2. Payment-error guidance hint (the "有料失敗時に案内" half of P1-4)

- REQ-FUND-010: THIS FEATURE SHALL NOT auto-trigger REQ-FUND-001's mint from ANY paid command's
  `insufficient_funds`/payment-rejection error path (`image`/`video`/`music`/`speech`/`realface`, or any
  other paid command) — **deliberate, documented deviation from blockrun-mcp**: ground truth, confirmed
  live via `grep -rl launchTopUp src/tools/` in the reference repo, is that `image.ts`/`video.ts`/
  `music.ts`/`speech.ts`/`realface.ts` EACH call `launchTopUp()` (mint a FRESH link + attempt to open it)
  automatically inside their `isPaymentRejectionError` catch branch, on EVERY out-of-funds failure.
  Rationale for not mirroring this: (a) it bolts an EXTRA live network round-trip + x402 signature onto an
  ALREADY-FAILED command's error path, adding latency and a second, independent failure surface, purely to
  populate a URL that may go unseen by a non-interactive/headless agent caller; (b) it would make the
  JSON error contract's shape/timing depend on a SEPARATE network call's outcome, working against
  `blockrun-cli-agent-dx`'s just-shipped goal of a deterministic, side-effect-free `{error, code, message}`
  contract; (c) the caller (human or agent) can already discover and invoke the funding flow explicitly via
  the STATIC hint this REQ's sibling, REQ-FUND-011, adds to the error text itself — no live call is forced
  onto every failure.
- REQ-FUND-011: `src/core/errors.ts`'s `formatError()`'s EXISTING `payment_error`-classified branch (the
  one guarded by `classification === "payment_error"`, per `blockrun-cli-agent-dx`'s
  `classifyKnownError()` extraction) SHALL gain ONE additional guidance line, appended AFTER the existing
  "Quick fix: Send USDC..." line, shown ONLY when the resolved chain (`opts?.chain ?? "base"`) is `"base"`
  (NOT `"solana"` — Onramp is Base-only, REQ-FUND-NG-001): a static pointer to the card-funding path, e.g.
  `Prefer a card? Run: blockrun wallet --action deposit`. This is a STATIC TEXT ADDITION ONLY — no network
  call, no `launchTopUp()`-equivalent invocation, from inside `formatError()` (a currently-pure function
  with zero I/O — this REQ MUST NOT give it any).
- REQ-FUND-012: REQ-FUND-011's new line SHALL be VERIFIED, not assumed, to be additive/non-breaking
  against EVERY existing payment-error assertion in `test/unit/errors.test.ts` — grounded finding (read
  live before writing this REQ): all 6 such assertions use `assert.match`/`assert.doesNotMatch`
  (substring/regex checks: `/needs funding/`, `/Base network/`, `/Solana network/`,
  `doesNotMatch(/temporary API issue/)`), NONE use `assert.equal` against the full `formatError()` output
  for a payment-error case — so appending a line cannot break any of them. (The 2 EXACT-equality
  `assert.equal` cases in that file — "plain validation message" and the two dollar-amount-misread-as
  -402 cases — are NOT payment-error branches at all, unaffected by definition.)
- REQ-FUND-013: FOR `chain === "solana"`, `formatError()`'s payment-error guidance text SHALL be
  UNCHANGED — no card-funding hint is added (Onramp is Base-only) — this is the existing REQ-DX-NG-003
  -style "preserve existing meaningful text" guarantee extended to this new line: it is purely ADDITIVE
  for the Base case, and simply ABSENT (not a broken/wrong hint) for the Solana case.

---

## 3. Documentation reflection (README.md / PARITY.md)

- REQ-FUND-014: README.md's `## Fund your wallet` section SHALL document the new card-funding path:
  `blockrun wallet --action deposit` mints a one-time Coinbase card-purchase link (Base only), and
  `--open` auto-launches it in the default browser (default: printed only, not opened — REQ-FUND-008).
- REQ-FUND-015: PARITY.md's `wallet` section SHALL be updated to record THREE intentional non-parity
  points introduced by this feature (in the SAME style as the EXISTING `--budget-limit`/`--max-quote-usd`
  bullets in "Known non-parity points"):
  1. The `url` field name (CLI) vs MCP's `onramp_url` (REQ-FUND-004).
  2. `--open`-gated (CLI, default OFF) vs MCP's unconditional auto-open (REQ-FUND-008).
  3. No auto-mint-on-payment-failure for the 5 media commands (CLI) vs MCP's `launchTopUp()`-on-failure
     behavior (REQ-FUND-010).
- REQ-FUND-016: PARITY.md's `wallet` section's EXISTING content (MCP tool naming, CLI form, dual-run
  evidence) SHALL otherwise remain UNCHANGED — this is a narrow, additive documentation delta, not a
  rewrite.

---

## 4. Cross-cutting / regression

- REQ-FUND-017: THIS FEATURE introduces NO new required spend — REQ-FUND-001's mint is $0-enforced BY
  THE CLIENT (REQ-FUND-003's `onQuote` zero-cap guard, not merely a server-side "expected $0" claim
  trusted blindly), verified by confirming `~/.blockrun/cli-budget.json`'s `spent`/`calls` counters are
  UNCHANGED before/after a `wallet --action deposit` invocation (the SAME money-safety verification
  pattern `blockrun-cli-docs`/`blockrun-cli-agent-dx` already established for their own $0-by-construction
  live calls).
- REQ-FUND-018: THE existing test suite (`npm test`, 532 tests at THIS feature's start, per
  `blockrun-cli-agent-dx`'s final green count — a growing floor, not a fixed target, as THIS feature's
  own new tests are added on top of it) SHALL remain 100% green throughout and at the end of this
  feature.
- REQ-FUND-019: `blockrun commands --json`'s `wallet` catalog entry's `costModel` SHALL remain `"free"`
  after this feature ships (REQ-FUND-NG-003) — verified mechanically (the SAME `gatePaidCall(` source
  -grep `blockrun-cli-agent-dx`'s `src/core/cost-model.ts` already performs, re-run against the POST-this
  -feature `src/commands/wallet.ts`).
- REQ-FUND-020: EVERY new REQ in §1-§3 above SHALL have a corresponding NEW test added under the EXISTING
  test-file conventions (`test/unit/*.test.ts`, `test/integration/*.test.ts`, or `test/cli/*.test.ts` per
  `package.json`'s `test` script), following the SAME Red→Green TDD discipline already used throughout
  this repo.

---
