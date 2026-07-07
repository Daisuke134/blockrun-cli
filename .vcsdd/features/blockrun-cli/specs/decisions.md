# blockrun-cli — Phase 2a implementation decisions

Recorded by the TDD-Red author so the Green-phase author (and the adversary) can trace
why the test suite is shaped the way it is. These are engineering decisions filling gaps
the spec explicitly left open (verification-architecture.md §6.2), not spec deviations.

## 1. CLI argument-parsing library: `commander`

verification-architecture.md §6.2 item 2 explicitly defers the concrete parsing library
choice to Phase 2 ("no functional REQ depends on which library is used as long as the
`--param` / `--param-json` / `--param @file.json` flag contract holds").

Decision: **`commander`** (`^15.0.0`, current npm latest as of 2026-07-07 —
`npm view commander version`).

Rationale (source-cited, not invented):
- It is the single most-used Node CLI framework (weekly npm downloads consistently the
  highest among yargs/citty/commander per npm registry download counts) and has zero
  runtime dependencies, minimizing the dependency surface for a CLI whose only job is
  flag parsing → pure `args/<command>.ts` mapping → SDK call.
- `blockrun-mcp` itself (the grounding clone) has NO CLI parser to mirror (it's an MCP
  server, not a CLI), so there is no "match the sibling repo" constraint here — the
  choice is free per §6.2, and commander is the smallest standard choice that supports
  per-subcommand flag definitions with type coercion, `.option()` repeatable flags (for
  `--stop <value>` up to 4), and a builtin `--help` renderer we can override to honor
  REQ-014's ≤30-line body constraint.
- citty/yargs were considered; commander was picked for being dependency-free and having
  the simplest per-subcommand registration API, matching REQ-001/REQ-002's "one binary,
  18 registered subcommands" shape most directly (`program.command(name)` × 18).

## 2. Entry point naming: `src/index.ts` → `dist/index.js` (not `cli.ts`/`dist/cli.js`)

verification-architecture.md §1.2 names the entrypoint module `cli.ts` and §2.2's
PROP-114 example invokes `node dist/cli.js`. The task brief that kicked off this Red
phase (and REQ-001's `package.json bin.blockrun`) specifies `bin: {"blockrun":
"./dist/index.js"}` built from `src/index.ts` via `tsup src/index.ts --format esm --dts
--clean` (mirroring blockrun-mcp's own `build` script, which builds `src/index.ts` →
`dist/index.js`).

Decision: use `src/index.ts` / `dist/index.js` as the ONE entrypoint module — this is
the same module verification-architecture.md calls `cli.ts`, just named to match
blockrun-mcp's own convention and the package.json `bin` field cited in REQ-001. All Tier
2b subprocess tests in this suite invoke `node dist/index.js <command> ...`, not
`dist/cli.js`. No functional requirement depends on the filename.

## 3. `args/<command>.ts` pure builder contract

verification-architecture.md §1.1 specifies `args/<command>.ts (×18) — pure
buildRequest(flags) → { endpoint?, params?, body? }`, validated with the ported zod
schema before returning. To make this testable uniformly across all 18 commands
(including SDK-method-dispatch commands like `chat`/`wallet` that don't have a literal
`endpoint`, vs. path-passthrough commands like `surf`/`rpc` that do), every
`src/args/<command>.ts` module exports a single function:

```ts
export type BuildResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function buildRequest(flags: Record<string, unknown>): BuildResult<CommandRequest>;
```

Where `CommandRequest` is a per-command shape (documented at the top of each
`args/<command>.ts`) mirroring the clone's zod `inputSchema` fields 1:1 (REQ-003), plus
any command-specific derived fields the command layer needs (e.g. `estimatedCost` is
NOT part of this shape — cost estimation is a separate `core/cost/<command>.ts` call,
kept orthogonal per verification-architecture §1.1's own table split). `ok:false` is
returned (never thrown) for a locally-detectable validation failure (missing required
field, wrong type, failed enum, path traversal, invalid network slug) so the command
layer can render it via REQ-010/REQ-011 without a try/catch around the pure layer.

Each `src/args/<command>.ts` ALSO exports its raw zod object schema as `schema` (the
literal port of the clone's `inputSchema`), independent of `buildRequest`, so
`test/unit/schema-parity.test.ts` (Tier 0/1, PROP-002) can `schema.safeParse()` the
fixture payloads without needing a full `buildRequest` call for every field-shape
assertion.

## 5. `commands/<command>.ts` handler contract: return, don't write

verification-architecture.md §1.2 describes `commands/*.ts` as writing stdout/stderr and
setting the process exit code directly. To keep these Tier-2-testable in-process (per
the same section's own Tier 2(a) description: "assert...the command's stdout/exit-code
contract holds against a canned mock response"), each `src/commands/<command>.ts`
exports:

```ts
export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
): Promise<{ exitCode: number; stdout: string; stderr: string }>;
```

`run()` performs the SAME work verification-architecture.md assigns to the command
layer (delegate to `args/<command>.ts` → call the SDK/shell flow → render via
`render.ts`) but returns the three output channels as plain values instead of writing to
real `process.stdout`/`process.stderr`/`process.exit`. The ONE real-I/O call site is
`src/index.ts`'s dispatch loop, which awaits `run()` and then actually writes/exits.
This is a strictly more-testable equivalent of the same impurity boundary — no
additional real I/O is introduced, and the Tier 2b subprocess tests (which spawn the
real built binary) still prove the full write/exit path end-to-end.

## 6. `shell/manual-x402.ts` contract for the four manual-402 commands (video/music/speech/realface)

To make the Tier 2 mocked-SDK tests for `video`, `music`, `speech`, and `realface`
(`enroll`/`portrait`) independent of each command's exact internal polling loop,
`src/shell/manual-x402.ts` exports two functions that ARE the impure chokepoint per
verification-architecture.md §1.2 (network + SDK's `createPaymentPayload`/
`parsePaymentRequired`/`extractPaymentDetails`, never constructed by hand — REQ-221):

```ts
export interface X402Request {
  endpoint: string;
  body: Record<string, unknown>;
  resourceDescription: string;
  maxTimeoutSeconds?: number;
}
export interface X402Result {
  data: Record<string, unknown>;
  billedUsd: number | null;
  txHash?: string;
}

// Single probe → 402 → sign → resubmit round trip. Used by speech (speak/sound_effect)
// and realface (enroll/portrait).
export async function payOnce(req: X402Request): Promise<X402Result>;

// Same round trip, then polls the same URL with the same payment header until
// status:"completed"/"failed" or the budget elapses. Used by video and music.
export async function payAndPoll(
  req: X402Request & { pollIntervalMs: number; totalBudgetMs: number },
): Promise<X402Result>;
```

`realface`'s free actions (`init`/`status`/`list`) never pay, so they go through a
separate free-fetch helper, `src/shell/http.ts`'s `fetchJson(url, init) => Promise<{
status: number; data: Record<string, unknown> }>`, mocked independently in that
command's Tier 2 test.

## 7. RESOLVED (was: KNOWN GAP) — spec revised mid-Sprint-1 (v3, budget persistence + REQ-023 aliases); v4 delta pass completed below (§8-§13)

Spec-review adversary iteration-3 PASSED with 0 blocking findings and the spec is now
final as v4. The REQ-022/REQ-023 alias-conflict gap flagged below has been closed by the
Sprint-2 delta pass — see §8 (budget-limit), §9 (cli-budget-schema), §10 (alias/conflict
builder contract), §11 (`--max-quote-usd` + test-only API base override), §12
(agent_id threading), §13 (search/exa alias tables) for the new contracts, and the new
test files listed in each section for the corresponding coverage. Original gap note
retained below for history/traceability, superseded by §8-§13:

While this Sprint-1 Red-phase test suite was being written, `behavioral-spec.md` and
`verification-architecture.md` were being revised CONCURRENTLY by another process on
this same working tree (git history: `9c82631` iteration-2 PASS → entered phase 2a →
`7eb2211` an independent codex-review found 5 blocking findings AFTER that gate → `799ff43`
spec v3 resolving them → `f3597ad` iteration-3 opened → `0e9fdba` codex round-2, "4/5
resolved, 3 residual blocking (text contradictions)" still open as of this commit). That
process's commits also swept up this suite's files via a shared working directory (no
worktree isolation between the two concurrent sessions — a violation of this repo's own
`.claude/rules/worktree.md` "同じブランチで複数エージェントが作業しない" rule, flagged
here for whoever operates the pipeline, not fixable by this agent).

Confirmed, ALREADY-FIXED impact: REQ-019 changed from "no cross-process persistence" to
"persist a ledger to `~/.blockrun/cli-budget.json`" (REQ-019/019a/019b/019c) and `wallet`
gained REQ-107a (`delegate`/`report` read/write that same file). `test/unit/budget.test.ts`
had one test asserting the OLD (now-wrong) claim — corrected above.

NOT YET fixed (this suite still reflects the PRE-v3 spec here — flagged, not silently
left uncovered): REQ-022/REQ-023 introduced a new cross-cutting alias/canonical-flag
contract (e.g. `chat`'s REQ-108a positional-vs-`--message` conflict rejection, REQ-114a
`--thinking-budget-tokens` vs `--thinking` conflict rejection) that likely has siblings
across several of the other 17 commands' §2 sections in the CURRENT spec text — this
suite does not yet have the "both forms produce an identical request" / "both forms
supplied together is a conflict error" test pairs REQ-023 requires. A follow-up Red-phase
pass MUST re-read the full CURRENT `behavioral-spec.md` §2 (once codex round-2's 3
residual blocking findings are resolved and the spec-review gate re-PASSES) and add the
missing REQ-023 alias-conflict tests before Phase 2b (Green) treats this suite as the
complete contract.

## 4. `--param-json` / `--param @file.json` flag naming (REQ-004)

For a command flag `--foo` whose value is object/array-typed (e.g. `chat --messages`,
`surf --params`, `surf --body`), the CLI additionally accepts:
- `--foo-json '<json>'` — inline JSON string
- `--foo <path>` where the value starts with `@` — read `path` (after stripping the
  leading `@`) as a UTF-8 file and `JSON.parse` its contents

Both normalize to the same parsed value before being handed to the field's zod
sub-schema, so `args/<command>.ts` sees one already-decoded value regardless of which
form the caller used. This is exercised by the Tier 1 flag-parsing-harness test
(PROP-003) shared across every command that has a JSON-shaped flag.

## 8. Per-invocation `--budget-limit` resolution (REQ-018, PROP-010)

A new pure function, `src/core/budget-limit.ts`:

```ts
export function resolveInvocationBudgetLimit(
  flagValue: number | undefined,
  envValue: string | undefined,
): number | null; // null = unlimited
```

Precedence: `flagValue` (if a positive number) > `parseBudgetLimitEnv(envValue)` (the
already-ported `core/budget.ts` function) > `null` (unlimited). This function takes ONLY
plain arguments (the flag value already parsed by commander, and `process.env.
BLOCKRUN_BUDGET_LIMIT` already read by the impure shell and passed in) — it never reads
`process.env` itself, and it never touches `~/.blockrun/cli-budget.json`, which is the
mechanical proof PROP-010 requires ("assert...ZERO reads/writes of cli-budget.json").
This cap stays entirely in the command layer's local variable for the lifetime of one
invocation (REQ-018's "EPHEMERAL...never read from or written to the persisted ledger").

## 9. `~/.blockrun/cli-budget.json` persistence (REQ-019 family, PROP-011/011a)

`src/core/cli-budget-schema.ts` (pure, per verification-architecture.md §1.1):

```ts
export interface AgentBudgetEntry { limit: number; spent: number; calls: number }
export interface CliBudgetLedger {
  version: 1;
  global: { limit: number | null; spent: number; calls: number };
  agents: Record<string, AgentBudgetEntry>;
  updatedAt: string; // ISO-8601
}

export function emptyLedger(seedLimit: number | null, now: () => string): CliBudgetLedger;
export function encodeBudgetLedger(ledger: CliBudgetLedger): string;   // JSON.stringify
export function decodeBudgetLedger(raw: string): CliBudgetLedger;      // JSON.parse + shape validation
// Bridges to the ALREADY-PORTED core/budget.ts logic (REQ-019c: "apply the SAME
// checkBudget/recordActualSpend logic ported from budget.ts") by converting the
// file's plain-object `agents` map to/from budget.ts's in-memory `Map`-based
// BudgetState, so the persisted-ledger check/spend path reuses the identical pure
// logic rather than re-deriving it:
export function toBudgetState(ledger: CliBudgetLedger): BudgetState;
export function fromBudgetState(state: BudgetState, updatedAt: string): CliBudgetLedger;
export function checkPersistedBudget(
  ledger: CliBudgetLedger, agentId: string | undefined, estimate: number,
): { allowed: boolean; reason?: string }; // wraps toBudgetState + core/budget.ts's checkBudget
export function applyPersistedSpend(
  ledger: CliBudgetLedger, agentId: string | undefined, actualUsd: number, estimate: number, now: () => string,
): CliBudgetLedger; // wraps toBudgetState + recordActualSpend + fromBudgetState, returns a NEW ledger (immutable)
```

The impure shell, `src/shell/budget-store.ts` (per verification-architecture.md §1.2),
owns the actual file I/O around these pure functions:

```ts
export function readLedger(): CliBudgetLedger;                 // reads ~/.blockrun/cli-budget.json, or emptyLedger(seed) if absent
export function writeLedgerAtomic(ledger: CliBudgetLedger): void; // write to cli-budget.json.tmp-<pid> in the SAME dir, then fs.renameSync over the target (REQ-019b)
```

`readLedger()` is the ONLY place that reads `process.env.BLOCKRUN_BUDGET_LIMIT`, and ONLY when the file does not yet exist (`emptyLedger(parseBudgetLimitEnv(process.env.BLOCKRUN_BUDGET_LIMIT), () => new Date().toISOString())`) — per REQ-019a's v4 addition, once the file exists on disk, `readLedger()` decodes it as-is and never re-consults the env var again, so a later change to `BLOCKRUN_BUDGET_LIMIT` has zero effect on an already-persisted `global.limit` (tested in `test/integration/budget-store.test.ts`, not in the pure `cli-budget-schema.test.ts`, since "does the file exist yet" is inherently an fs/impure-shell question).

Test-only seam: `readLedger`/`writeLedgerAtomic` resolve the file path via
`path.join(os.homedir(), ".blockrun", "cli-budget.json")` — same `os.homedir()`/`HOME`
mechanism as REQ-017's wallet-file isolation, so Tier 2 tests point at a real temp dir by
setting `HOME` for the test process (no separate env var invented for this).

## 10. Alias / canonical-flag conflict-rejection contract (REQ-023, extending §3's `BuildResult`)

Every `args/<command>.ts` whose command has a REQ-023 alias (chat, image, video, music,
speech: positional-vs-canonical scalar; chat: `--thinking-budget-tokens` vs `--thinking`;
search/exa: body-shape aliases, §13) follows ONE resolution rule inside `buildRequest`,
checked BEFORE zod validation:

1. If the alias form is supplied AND the canonical form is ALSO supplied (whether they
   agree or not — REQ-023 says "never accepted in silent conflict...even matching"
   is not required to be checked for equality, just presence-conflict), return
   `{ ok: false, error: "... conflicts with ... — supply only one" }`.
2. If ONLY the alias is supplied, compile it into the canonical field before building
   the request (so `buildRequest`'s OUTPUT shape is always keyed by canonical field
   names — the alias never appears in the returned `CommandRequest`).
3. If ONLY the canonical is supplied (or neither, when optional), proceed as today.

Positional arguments arrive from `src/index.ts`'s commander wiring as a `$positional:
string[]` array appended to the flags object handed to `buildRequest` (commander's own
`program.argument('[prompt]')` capture) — e.g. `blockrun chat "hi"` calls `buildRequest({
$positional: ["hi"] })`, and `blockrun chat --message "hi"` calls `buildRequest({ message:
"hi" })`; both MUST produce `{ ok: true, value: { message: "hi", ... } }` (REQ-108a's
"IDENTICAL request" requirement) — proven directly in each affected command's
`test/unit/<command>.test.ts` (extended in this delta pass) rather than a separate file,
since positional-vs-canonical is a single command-local concern (unlike search/exa's
multi-field body aliases, which get their own files per §13).

## 11. `video --max-quote-usd` (REQ-135a) and the test-only API-base override

`src/args/video.ts`'s `buildRequest` validates `--max-quote-usd` is a positive finite
number when supplied (rejected locally otherwise, per REQ-135a's "abort BEFORE
`createPaymentPayload()`" contract starting even earlier at the args layer for a
malformed value). The actual quote-vs-cap comparison happens in `src/commands/video.ts`
against the REAL 402 quote, calling `shell/manual-x402.ts`'s `payAndPoll` with an
`onQuote` callback (mirroring the clone's `reReserveIfHigher` callback shape) that throws
BEFORE the function would call `createPaymentPayload` if the quote exceeds the cap.

verification-architecture.md §2.2's PROP-114 explicitly requires a Tier 2b **subprocess**
test against "a local stub HTTP server" for this gate — since `shell/manual-x402.ts`
otherwise targets the hardcoded `https://blockrun.ai/api` (mirroring the clone's
`BLOCKRUN_API` constant), a built binary cannot be pointed at a local stub without SOME
override. Decision: `shell/manual-x402.ts` reads its base URL from an env var,
`BLOCKRUN_API_BASE_URL`, defaulting to `https://blockrun.ai/api` when unset. This is
NOT a user-facing feature and is NOT documented in the CLI's README as a supported
override (avoiding any tension with REQ-017's specific, narrow prohibition on inventing a
`BLOCKRUN_HOME` config-dir override) — it exists solely so `test/cli/video-max-quote-usd.
test.ts` can spawn the real built binary against an in-process `node:http` stub server
instead of the real gateway, which is the ONLY way to satisfy PROP-114's explicit
subprocess-tier requirement without spending real USDC in Tier 2.

## 12. `agent_id` threading (REQ-022, PROP-205)

`test/unit/agent-id-threading.test.ts` is table-driven across the 15 commands whose
source `inputSchema` declares `agent_id` (all 18 minus `wallet`, `models`, `dex` — REQ-022
itself names this set): `chat`, `image`, `video`, `realface`, `music`, `speech`, `search`,
`exa`, `markets`, `price`, `rpc`, `defi`, `modal`, `phone`, `surf`. For each, the test
imports that command's `buildRequest`, calls it once WITH `agentId`/`agent-id`-equivalent
flag set and once WITHOUT, and asserts: (a) when set, the returned `CommandRequest`
carries `agent_id` verbatim; (b) when NOT set, the key is absent from the object
entirely (`!('agent_id' in value)`), never present as `agent_id: undefined` (a Green-phase
implementer using an object spread with an `undefined` value would still satisfy `in`
falsely — the test uses `Object.prototype.hasOwnProperty`-based absence, not just
`=== undefined`, to catch that).

## 13. `search`/`exa` alias tables (REQ-152a, REQ-154a, PROP-206)

New files `test/unit/search-alias.test.ts` and `test/unit/exa-alias.test.ts`, table-driven
one row per documented alias (search: `--query`→`body.query`, `--sources`→`body.sources`,
`--max-results`→`body.max_results`, `--from-date`→`body.from_date`, `--to-date`→
`body.to_date`; exa per-path: `search`'s `--query`/`--num-results`/`--category`/
`--include-domains`/`--exclude-domains`, `answer`'s `--query`, `contents`'s `--urls`,
`find-similar`'s `--url`/`--num-results`). Each row asserts the alias form and the
equivalent `--body '{...}'` canonical form produce an IDENTICAL `CommandRequest.body`,
and that supplying BOTH the alias and a `--body` that also sets the same field is
rejected (same conflict rule as §10, applied per-field to the resolved body object
rather than to a single top-level scalar).
