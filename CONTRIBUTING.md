# Contributing to blockrun-cli

PRs welcome. This CLI wraps 18 commands over `@blockrun/llm`; reviews are usually fast.

## Setup

```bash
git clone https://github.com/Daisuke134/blockrun-cli
cd blockrun-cli
npm install
npm run typecheck     # tsc --noEmit
npm run build         # tsup → dist/
npm run dev           # tsx watch mode
```

Run the test suite:

```bash
npm test
```

`npm run test:e2e` runs the live end-to-end suite against the real BlockRun API — it requires a
funded sandbox wallet (real USDC on Base) and is not part of the default `npm test` run. See
`VERIFICATION.md` for the environment this repo's own 18/18 E2E pass used.

To try a dev build locally:

```bash
node dist/index.js wallet --action status
```

## Design rule — new command vs. extending an existing one

This CLI has no separate skill-file mechanism (unlike the `blockrun-mcp` server it wraps, which
documents long endpoint catalogs in a set of per-topic skill documents alongside its MCP tools) —
every capability here is either a new top-level command or a new alias/flag on an existing one:

**Add a new top-level `blockrun <command>`** when:
- BlockRun ships a genuinely new API surface (a new `blockrun_*` MCP tool in the upstream
  `blockrun-mcp` server) that isn't already covered by one of the 18 existing commands
- The surface needs its own typed parameter validation (enums, ranges, structured shapes)

**Extend an existing path-based command's alias table** (`markets`/`surf`/`rpc`/`defi`/`modal`/
`phone`/`exa`/`search`) when:
- The new capability is reachable via that command's existing `--path`/`--params`/`--body`
  passthrough — no new command is needed, just documentation and (optionally) a new ergonomic
  `--flag` alias that compiles into `--body`, mirroring `search`'s `--query`/`--max-results`/etc.

## Adding a new command

1. Add `src/args/<command>.ts` — a pure `buildRequest(flags) => { ok: true, value } | { ok: false, error }`
   function, plus the command's zod `schema` object (ported 1:1 from the source `blockrun_<command>`
   MCP tool's `inputSchema` — same field names, same enums, same defaults).
2. Add `src/commands/<command>.ts` — the handler that calls `buildRequest`, dispatches to
   `@blockrun/llm`, and renders the result via `core/render.ts`'s `ok()`/`fail()`.
3. Register the command in `src/index.ts` (one `program.command(...)` call).
4. Add a row to the README's `## Commands` table.
5. `npm run typecheck && npm run build && npm test` before opening a PR.

## x402 payment patterns

Two flavors, both wrapping `@blockrun/llm` — never reimplementing x402 signing or wallet management:

- **Sync, single-call** (`payOnce` in `src/shell/manual-x402.ts`): probe → 402 → sign → resubmit, one
  signature, one settlement. Used by `speech` (`speak`/`sound_effect`) and `realface`
  (`enroll`/`portrait`).
- **Async, payment-on-completion** (`payAndPoll` in `src/shell/manual-x402.ts`): submit → 402 → sign →
  poll the same URL with the same `PAYMENT-SIGNATURE` header until `status:"completed"`. Used by
  `video` and `music`. Upstream failure or timeout = no charge.

For the path-based passthrough commands (`markets`/`surf`/`rpc`/`defi`/`modal`/`phone`/`exa`/
`search`), payment is handled entirely inside `@blockrun/llm`'s `getWithPaymentRaw`/
`requestWithPaymentRaw` — no manual x402 code is needed.

## CHANGELOG

Add an entry to `CHANGELOG.md`. Format:

```
## X.Y.Z

- **`command` — one-line headline.** 1-2 sentences on why it matters.
  - Sub-bullet for distinct sub-changes
- Second independent change in the same format.
```

Bump `package.json`'s `version` to match (semver: patch for fixes, minor for new commands, major for
breaking changes).

## Pull request checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] New/changed command reflected in the README Commands table
- [ ] `CHANGELOG.md` entry follows the template above
- [ ] `package.json` version bumped

One feature/fix per PR. Include what the command does and its cost in the PR description.

## Issues

[github.com/Daisuke134/blockrun-cli/issues](https://github.com/Daisuke134/blockrun-cli/issues)
