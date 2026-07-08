# Purity Boundary Audit — blockrun-cli-pack-fix (Phase 5)

## Declared Boundaries

Per `specs/behavioral-spec.md` (REQ-PACK-001/002/003) and `specs/verification-architecture.md`, this
feature's core claim is a **purity-boundary relocation**: the impurity (filesystem access to derive
`COMMAND_COST_MODEL`) was declared to move from RUNTIME (impure, executed on every CLI invocation,
inside the shipped `dist/index.js`) to BUILD/GENERATION-TIME (impure, but confined to a `prebuild`
script that runs only in the maintainer's own dev/CI environment and never ships). The declared
post-fix state:

- **Generation time** (`scripts/generate-cost-model.mjs`, run via `npm run build`'s `prebuild` hook):
  IMPURE — reads `src/commands/*.ts` from disk (`readdirSync`, `readFileSync`), writes
  `src/core/cost-model.generated.ts` (`writeFileSync`). This impurity is DECLARED and ACCEPTED — it is
  a one-time, dev-machine-only, deterministic transformation of committed source into a committed
  literal.
- **Runtime** (`src/core/cost-model.generated.ts`, `src/core/cost-model.ts`, and everything bundled
  into `dist/index.js`): DECLARED PURE for this concern — a plain object literal export with zero
  filesystem access, zero `import.meta.url` path resolution, zero dependency on `src/` existing at all.

## Observed Boundaries

Verified both sides of the declared boundary directly, firsthand, in this session:

**Generation-time impurity — confirmed present and correctly scoped:**
```
scripts/generate-cost-model.mjs:
  readdirSync(COMMANDS_DIR)                     — impure, disk read
  readFileSync(path.join(COMMANDS_DIR, file))    — impure, disk read
  writeFileSync(OUT_PATH, contents, "utf8")      — impure, disk write
```
- Confirmed `scripts/` is excluded from `package.json`'s `"files": ["dist", "README.md"]` — this
  impurity NEVER reaches an end user's machine; it is a maintainer/CI-only concern.
- Confirmed it runs automatically via the `"prebuild"` npm lifecycle hook (`package.json` line
  `"prebuild": "node scripts/generate-cost-model.mjs"`), invoked transparently by `npm run build` —
  matches REQ-PACK-003 exactly.
- Confirmed determinism: ran `npm run build` in this session; `git status --short
  src/core/cost-model.generated.ts` was EMPTY afterward — regenerating from the same source produces
  byte-identical output to what's committed. No hidden nondeterminism (no timestamps, no random IDs,
  sorted `Object.entries` by key) leaking into the generated file.

**Runtime purity — confirmed present:**
```
src/core/cost-model.generated.ts:  plain `export const COMMAND_COST_MODEL: Record<string, CostModel> = {...}`
                                    — a literal object, zero imports beyond the `CostModel` type, zero
                                    fs/path/import.meta.url usage.
src/core/cost-model.ts:            `export { COMMAND_COST_MODEL, type CostModel } from
                                    "./cost-model.generated.js"` — a bare re-export, no logic, no I/O.
```
- Grepped both files for `readFileSync|readdirSync|import.meta.url|process.cwd|__dirname`: the only
  match across both files is a code COMMENT in `cost-model.ts` (line 7) describing the OLD, now-removed
  runtime behavior for historical/reviewer context — not executable code.
- Grepped the built `dist/index.js` bundle directly for `findCommandsDir`/`COMMANDS_DIR` (the prior
  runtime-scan function/constant names): **zero occurrences** — the old impure runtime path is
  completely absent from the shipped artifact, not just refactored-but-still-present.
- Live proof the boundary actually moved (not just declared): the Phase-5 packaging proof (see
  `verification-report.md`) ran the REAL packed-and-extracted `dist/index.js` from inside a directory
  with NO sibling `src/` at all, under a throwaway `HOME`, and both `--version` and `commands --json`
  exited 0 — this is only possible if the runtime code genuinely never touches `src/commands/` anymore.
  Under the OLD (pre-fix) architecture, this exact scenario is what crashed in production.

**No boundary leakage into adjacent code**, confirmed by the impl-review's own audit (re-verified here):
grepping the rest of `src/` for `readFileSync|readdirSync|existsSync|import.meta.url` finds only
`src/shell/wallet.ts`, `src/shell/qr.ts`, `src/shell/budget-store.ts` (all resolve via
`path.join(os.homedir(), '.blockrun')` — a legitimate user-config directory, not a repo/src-relative
path, and unrelated to this feature) and `src/cli/json-flag.ts` (reads a user-supplied `@file.json` CLI
argument — again unrelated, pre-existing, and not a repo-relative concern). Nothing else in the runtime
surface depends on `src/` existing.

## Summary

| Boundary | Declared | Observed |
|---|---|---|
| Generation-time fs access (`scripts/generate-cost-model.mjs`) | Impure, dev/CI-only, deterministic | Confirmed impure, confirmed excluded from shipped package, confirmed deterministic (zero drift post-build) |
| Runtime fs access for cost-model (`cost-model.generated.ts` / `cost-model.ts` / bundled `dist/index.js`) | Pure, zero fs/path resolution | Confirmed pure by grep of source AND built bundle; confirmed by live isolated-tarball execution with no sibling `src/` |
| Other runtime `fs` usage in the repo | Out of scope, pre-existing, user-home-relative or user-supplied-file-relative | Confirmed unrelated to this feature, unaffected |

The purity boundary moved exactly as declared: impurity is now fully contained at build/generation
time, confined to a non-shipped dev script, and the runtime surface (what actually ships to and executes
on a user's machine) is genuinely pure with respect to filesystem access for cost-model derivation — this
is the direct fix for the production crash (`Error: cost-model: could not locate src/commands/`). Phase 5
purity audit: **PASS**.
