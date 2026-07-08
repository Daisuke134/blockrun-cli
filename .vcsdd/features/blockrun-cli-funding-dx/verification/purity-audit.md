# Purity Boundary Audit — blockrun-cli-funding-dx (Phase 5)

## Declared Boundaries

`specs/behavioral-spec.md` and `specs/verification-architecture.md` declare (both directly and by
citing the pre-existing project convention) the following purity split, consistent with the wider
`blockrun-cli` codebase's `src/args/` → `src/commands/` → `src/shell/`/`src/core/` layering:

- **`src/shell/*.ts` = impure shell** — all network calls, filesystem I/O, and process-spawning live
  here. Named explicitly for this feature: `src/shell/manual-x402.ts` (`payOnce()`/`probeAndSign()` —
  the HTTP round-trip + signing), `src/shell/qr.ts` (`openUrl()` — OS-opener `child_process.spawn`),
  `src/shell/http.ts` (`fetchWithTimeout`), `src/shell/wallet.ts` (`ensureBaseWallet`, `getChain`,
  `getChainBalance`, `getWalletInfo` — key material + on-chain balance reads), `src/shell/budget-store.ts`
  (`readLedger`/`writeLedgerAtomic` — `~/.blockrun/cli-budget.json` file I/O).
- **`src/commands/*.ts` = orchestration, not raw I/O** — `wallet.ts`'s `run()` composes calls to the
  `shell` functions above plus `core` helpers; it is not declared pure (it awaits shell calls and
  branches on their results) but it is declared to perform **no I/O of its own** — every network/file/
  process side effect must be reached via an imported `shell` function, never a direct `fetch`/`fs`/
  `child_process` call inside `commands/`.
- **`src/core/*.ts` = pure** — `src/core/errors.ts`'s `formatError()` is explicitly called out
  (behavioral-spec.md line ~198-199, this feature's own comment at `errors.ts:109-111`) as staying
  "pure, zero I/O" even after this feature's addition of the REQ-FUND-011 card-funding hint — the hint
  is a static string template, no network call, no chain-state read.
- **`src/args/*.ts` = pure schema validation** — `buildRequest()` in `src/args/wallet.ts` is a Zod
  schema parse/validate step with no I/O; this feature added one new field (`open: z.boolean().optional()`)
  in the same pure style as the pre-existing fields.

## Observed Boundaries

Verified directly against the current file contents (not inferred from the spec) for every file this
feature's diff touches (`git diff --stat eeee0e3..HEAD`: `src/args/wallet.ts`, `src/commands/wallet.ts`,
`src/core/errors.ts`, `src/index.ts`):

- **`src/commands/wallet.ts` imports** (lines 4-12): `../args/wallet.js`, `../shell/wallet.js`,
  `../shell/qr.js`, `../shell/manual-x402.js`, `../shell/budget-store.js`, `../core/errors.js`,
  `../core/render.js`, `../types.js` — zero `node:fs`, `node:child_process`, `node:http`/`fetch`, or any
  other raw I/O import. Every side effect in the new `action === "deposit"` branch (lines 133-179) is
  reached exclusively through the imported `payOnce()` (mint) and `openUrl()` (browser open) shell
  functions — confirmed by reading the branch's full body, no inline `fetch`/`fs`/`spawn` call present.
- **`src/args/wallet.ts`**: imports only `zod` and a local `BuildResult` type. `schema` is a declarative
  Zod object; the new `open: z.boolean().optional()` field (REQ-FUND-008) follows the same pure-parse
  pattern as every pre-existing field. No I/O.
- **`src/core/errors.ts`**: the diff (`git diff eeee0e3..HEAD -- src/core/errors.ts`, +6 lines) adds a
  `if (chain === "base") { errorText += ... }` static-string branch inside `formatError()`, with the
  feature's own comment explicitly noting "No network call here — formatError() stays pure, zero I/O."
  Confirmed no I/O was introduced — the change is a pure string-template branch on an already-passed-in
  `chain` parameter.
- **`src/index.ts`**: diff is 2 lines (per `git diff --stat`) — not read in full detail here since it is
  the CLI's top-level command-registration wiring (out of the pure/impure split's scope, same class of
  file as the pre-existing command-registration code for every other command); no new I/O primitive
  expected or found in a `grep` for `fetch\|spawn\|readFile\|writeFile` against it (none present).
- **Shell layer, unmodified but load-bearing for this feature's guard**: `src/shell/manual-x402.ts`'s
  `probeAndSign()` (unchanged by this diff) is where the actual network I/O (`fetchWithTimeout`) and
  signing (`createPaymentPayload`) happen; `wallet.ts`'s `deposit` branch never duplicates or bypasses
  this — it calls `payOnce()` exactly once, matching the "same submit→402→sign→resubmit flow already
  used by image/video/music/speech/realface... never a hand-rolled x402 implementation" comment at
  `wallet.ts:142-145`.
- **`src/shell/qr.ts`'s `openUrl()`** (unmodified): the only place `child_process.spawn` is invoked for
  URL-opening; `wallet.ts` never spawns a process directly.

No hidden side effects were found: no direct `fs`/`fetch`/`child_process`/`crypto`-signing calls inside
`src/commands/wallet.ts`, `src/args/wallet.ts`, or the diff hunk of `src/core/errors.ts`. The
`deposit` branch's own error-handling (`try { ... } catch (err) { ... }`, lines 151-178) also stays
within this boundary — `extractErrorMessage(err)` (a `core/errors.ts` pure function) formats the caught
error into the fallback `note`, with no additional I/O performed in the catch block itself.

## Summary

No drift detected between the declared purity boundaries (`src/shell/` = impure I/O, `src/commands/` =
orchestration only, `src/core/`/`src/args/` = pure) and this feature's actual implementation. The new
`deposit` mint path reuses the existing `payOnce()`/`openUrl()` shell primitives without introducing any
new I/O surface inside `commands/`, `core/`, or `args/`. `formatError()`'s new card-funding hint remains
a pure string branch. No verifier-hostile coupling (e.g. a command file calling `fetch`/`fs` directly,
or a "pure" core function performing I/O) was found.

No follow-up required before Phase 6.
