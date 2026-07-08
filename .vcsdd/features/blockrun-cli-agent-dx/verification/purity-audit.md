# Purity Boundary Audit — blockrun-cli-agent-dx (Phase 5)

Feature: `blockrun-cli-agent-dx` · Mode: lean · Phase 5 (Formal Hardening)

## Declared Boundaries

Per `specs/verification-architecture.md` §1:

| Layer | Nature | Declared examples |
|---|---|---|
| Pure | `introspectSchema()`, `classifyError()`, `costModel` derivation, kebab-case flag-name conversion | New pure functions under `src/core/` or `src/args/` |
| Impure (network, no spend) | Live `blockrun commands [--json]` (no wallet call) | PROP-DX-002/003 |
| Impure (network, real spend-capable rail, no NEW spend by this feature) | Live `wallet --action status --json` against the existing funded sandbox | PROP-DX-009 |
| Impure (mocked SDK, Tier 1) | Unit tests stubbing a real command's network call to force `network_error`/`solana_client_error`/etc. deterministically | PROP-DX-006, PROP-DX-010 |
| Out of scope | Money-path internals (`checkBudget`/`reserveBudget`/x402 signing) — read-only for grounding, never modified | REQ-DX-NG-001 |

## Observed Boundaries

Compared against `git diff 624906c..HEAD -- src/` (27 files, 474 insertions / 56 deletions).

### New files (`src/core/*.ts`) — declared Pure

| File | Observed | Matches declared? |
|---|---|---|
| `introspect-schema.ts` | Pure. `introspectSchema()` only does structural traversal of an already-in-memory zod schema object (`schema.shape`, `_def`). No I/O, no network, no globals. | Yes |
| `error-classification.ts` | Pure. `classifyErrorCode()` is a chain of regex `.test()`/`.includes()` calls over a string argument, delegating to `errors.ts`'s `classifyKnownError()` (also pure). No I/O. | Yes |
| `commands-render.ts` | Pure. `renderCommandsOutcome()` does string formatting only, calling the pure `ok()` helper from `render.ts`. | Yes |
| `commands-catalog.ts` | Pure GIVEN its `program: Command` argument (an already-fully-constructed Commander object passed in by `src/index.ts` at call time). `buildCommandsCatalog()` performs no I/O itself — it reads properties off the object it's handed (`cmd.name()`, `cmd.description()`) and calls the pure `introspectSchema()`. The impurity (constructing `program` via Commander's own registration side effects) lives entirely in `src/index.ts`, outside this feature's new files. | Yes, with the same "operates on an already-constructed object" nuance the declared table implies by scoping this to `src/core/`. |
| `cost-model.ts` | **Nuance not explicit in the declared table.** `deriveCostModel()` performs synchronous local filesystem I/O (`readdirSync`, `readFileSync`) against `src/commands/*.ts` at **module load time** (line 44: `export const COMMAND_COST_MODEL = deriveCostModel()` — a top-level side effect, not a function called per-invocation). This is technically impure (filesystem access), but it is: (a) hermetic — reads only this repo's own already-checked-in source files, no network, no external mutable state; (b) deterministic — same source tree always produces the same registry; (c) synchronous and read-only — no writes, no environment dependency beyond `import.meta.url`. The verification-architecture's own prose (§2, PROP-DX-004) explicitly grounds this derivation in "inspecting whether each command's REAL source calls `gatePaidCall`" — i.e., the spec's OWN design for this PROP requires reading source files, so this file-I/O is an intentional, spec-sanctioned exception to the "Pure" label rather than an undocumented boundary violation. Categorizing it as "pure" in the declared table's shorthand sense (no network, no spend, no external mutable state) is reasonable; strictly it is impure-but-hermetic. |

**Finding**: `cost-model.ts` performs filesystem reads that the declared table's "Pure" bucket doesn't
literally cover (the table's row lists only `costModel derivation` under "Pure" without noting the
file-read mechanism), but §2/PROP-DX-004's prose for this exact PROP requires reading real source
files, so this is spec-sanctioned, not an undisclosed boundary drift. Not a blocking finding — noted
for traceability.

### Changed files — impure, network/shell layer

| File | Observed change | Matches declared? |
|---|---|---|
| `src/shell/wallet.ts` | `getSolanaUsdcBalance()`/`getBaseUsdcBalance()`/`getChainBalance()` return type changed from `number \| null` to a `ChainBalanceResult { balance, reason? }` object. Still purely additive to the EXISTING network-call shape (Solana RPC `getBalance()`, Base `eth_call` fetch loop) — no new network call added, no new spend path. Matches the declared "Impure (network, real spend-capable rail, no NEW spend)" row (PROP-DX-009) exactly: this is the SAME live wallet-balance code path, now surfacing WHY a null happened instead of adding new behavior. | Yes |
| `src/commands/wallet.ts` | Wires the new `ChainBalanceResult.reason` through to both `status` (`base.balanceUnavailableReason`/`solana.balanceUnavailableReason`) and `chain` (`activeBalanceUnavailableReason`, a deliberately different field name per REQ-DX-023) output shapes. Purely a shell-layer (command orchestration) change — no new I/O introduced, reuses `getChainBalance()`'s already-impure result. | Yes |
| `src/commands/dex.ts` | Two mechanical edits: (1) `usage_error` code added to the existing `fail()` call on schema-validation failure (no I/O change), (2) catch-block now calls `extractErrorMessage(err)` (a pure function, `errors.ts`) instead of inlining `err.message`. No new network call; the network call this command already made (`fetchJson()`) is unchanged. | Yes — this is the REQ-DX-017 catch-block wiring fix, purely mechanical. |
| `src/commands/{chat,defi,exa,image,markets,modal,models,music,phone,price,realface,rpc,search,speech,surf,video}.ts` (16 files) | Each gets an identical 2-line mechanical edit: `fail(built.error, opts.json)` → `fail(built.error, opts.json, { code: "usage_error" })` on the existing schema-validation-failure branch. Zero I/O change — this only attaches an explicit `code` to an ALREADY-EXISTING local validation failure path (REQ-DX-011 item 1, usage_error, which per the verification-architecture's own §2 note "cannot be derived from message text alone"). | Yes — catch-site edits are mechanical per the task brief's own framing; confirmed each is a 1-line diff touching only the `fail(...)` call, no new logic. |
| `src/core/render.ts` | `renderError()`/`fail()` now compute `exitCode` (previously hardcoded to `1`) via the new pure `classifyErrorCode()`/`EXIT_CODE_FOR_CODE` map, and accept an optional `code` override. Still 100% pure — string/object transformation only, no I/O added. | Yes |
| `src/core/errors.ts` | `classifyKnownError()` extracted as a new pure function (REQ-DX-016) from `formatError()`'s prior inline branches; `detectNetworkMarker()`/`extractErrorMessage()` added (REQ-DX-015) — both pure, operating only on the `err`/`cause` object already in hand, no I/O. | Yes |
| `src/index.ts` | New `commands` subcommand registered via Commander (`program.command("commands")...action(...)`), calling `buildCommandsCatalog(program)` then `renderCommandsOutcome(...)`. This IS the impure boundary the declared table's "Impure (network, no spend)" row (PROP-DX-002/003) refers to — except REQ-DX-001/REQ-DX-NG-005 specify this command makes **NO network call at all** (introspection is 100% local, over already-loaded schema modules and the already-registered Commander object). The declared table's phrase "Impure (network, no spend)" is slightly imprecise for this specific command — `commands` has no network I/O whatsoever, only process/CLI-registration side effects (reading `program.commands`, writing to stdout). Verified empirically in `verification-report.md`'s Tier 2 spot check #1: `commands --json` produces its 18-entry catalog with zero network calls (confirmed by the money-safety pattern this feature reuses — no budget-ledger movement possible since no `gatePaidCall` is ever reached on this path, per REQ-DX-NG-005). | Matches in spirit (no spend); the declared label "network, no spend" over-states the network component for `commands` specifically — it is process-local, not network-touching, at all. Not a violation, a documentation imprecision in the architecture doc itself, not the implementation. |

## Summary

Every new file under `src/core/` (`introspect-schema.ts`, `error-classification.ts`,
`commands-render.ts`, `commands-catalog.ts`) is pure as declared, with one nuance:
`cost-model.ts` performs synchronous, hermetic, spec-sanctioned local file reads at module-load
time — not literally I/O-free, but matching the declared boundary's intent (no network, no spend,
deterministic, no external mutable state) and explicitly required by PROP-DX-004's own grounding.
All changed shell-layer files (`shell/wallet.ts`, `commands/wallet.ts`, `commands/dex.ts`, the 16
other `commands/*.ts` catch-site edits, `index.ts`) stay within their declared impure boundaries —
no NEW network call, no NEW spend path was introduced anywhere in this diff, matching §3's Budget
Guard claim ("This feature introduces NO new required spend"). The one documentation imprecision
found (the declared table's "Impure (network, no spend)" label for the `commands` command, which is
actually 100% network-free/process-local) is a wording nuance in the architecture doc, not a
behavioral or security concern, and does not require a spec correction to proceed.

**Purity verdict: PASS.** Observed boundaries match declared boundaries (with the two documented,
non-blocking nuances above). No pure function was found to perform hidden I/O or network access; no
impure function's I/O footprint grew beyond what the diff review shows.
