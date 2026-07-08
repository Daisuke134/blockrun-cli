# Verification Report — blockrun-cli-pack-fix (Phase 5)

Feature: `blockrun-cli-pack-fix` (lean, TypeScript). `proofObligations` registered in `state.json`: 0
(lean mode — this hotfix has no formal proof-obligation set beyond the spec's own PROP-PACK-001..003,
which were already exercised at Phase 3/impl-review). This report re-executes the full verification
surface firsthand, live, in this session — nothing here is copied from prior evidence files.

## Proof Obligations

### 1. `npm test` — full regression suite

Command: `npm test` (runs `tsx --experimental-test-module-mocks --test test/unit/*.test.ts
test/integration/*.test.ts test/cli/*.test.ts`).

Result: **558/558 pass, 0 fail, 0 cancelled** (duration ~56.5s). Matches the count recorded in
`state.json`/`execution-notes.md` from the Green phase. Raw tail captured at `/tmp/pfx-npmtest.log`
during this run (not copied into this repo — ephemeral scratch, full stdout observed directly in this
session).

### 2. `npm run typecheck`

Command: `npm run typecheck` (`tsc --noEmit`).

Result: **exit 0, zero type errors.**

### 3. `node scripts/docs-check.mjs`

Command: `node scripts/docs-check.mjs`.

Result: **18/18 PASS, 0 FAIL** — PROP-001 through PROP-025 (docs-parity checks from the sibling
`blockrun-cli-agent-dx`/`blockrun-cli-docs` features) all green, confirming this hotfix touched nothing
that broke documentation parity.

### 4. Packaging proof (PROP-PACK-003 / REQ-PACK-006 — the regression test for the actual shipped bug)

Executed the full real-artifact flow firsthand, independent of the automated
`test/cli/packed-tarball.test.ts`:

```
npm run build
  → prebuild hook fired: "generate-cost-model: wrote 18 entries to src/core/cost-model.generated.ts"
  → tsup bundled dist/index.js (151.93 KB)
git status --short src/core/cost-model.generated.ts
  → EMPTY (no diff after regeneration — deterministic, zero drift between committed and freshly
    generated content)

npm pack --pack-destination /tmp/pfx-pack-1783510096
  → blockrun-cli-1.2.1.tgz, total files: 4 (LICENSE, README.md, package.json, dist/index.js — matches
    package.json's "files": ["dist","README.md"], NO src/ shipped, confirming the original bug's root
    cause condition is present in this real artifact, same as when the bug shipped)

cd /tmp/pfx-pack-1783510096 && tar -xzf blockrun-cli-1.2.1.tgz
  → package/{LICENSE, README.md, package.json, dist/index.js} — confirmed NO src/ directory exists
    alongside dist/ in the extracted package (isolation from the repo checkout's sibling src/,
    the exact condition that a symlink-based `npm install -g .` would have masked)

HOME=/tmp/pfx-freshhome-<ts> node dist/index.js --version   (run from inside package/, throwaway HOME)
  → stdout: "1.2.1", EXIT 0

HOME=/tmp/pfx-freshhome-<ts> node dist/index.js commands --json
  → EXIT 0, valid JSON, commands.length === 18
```

Both required invocations exited 0 from a genuinely isolated, packed-and-extracted tarball with a
throwaway `HOME` and no sibling `src/` directory — this is the exact scenario that crashed in
production for every user on 1.1.0/1.2.0 (`Error: cost-model: could not locate src/commands/ from
.../dist`), and it is now clean.

## Summary

| Check | Result |
|---|---|
| `npm test` | 558/558 PASS |
| `npm run typecheck` | PASS (0 errors) |
| `node scripts/docs-check.mjs` | 18/18 PASS |
| `npm run build` → generated-file drift | NONE (git diff empty post-build) |
| `npm pack` → extract → `--version` | EXIT 0, `1.2.1` |
| `npm pack` → extract → `commands --json` | EXIT 0, 18 commands |

All four proof surfaces (regression suite, type safety, docs parity, and the live packaged-artifact
execution that is the actual regression test for REQ-PACK-006) are green. No proof obligation failed.
Phase 5 verification: **PASS**.
