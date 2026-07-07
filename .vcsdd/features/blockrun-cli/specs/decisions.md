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
