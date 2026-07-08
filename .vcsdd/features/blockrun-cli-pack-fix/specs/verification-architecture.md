# blockrun-cli-pack-fix — Verification Architecture (lean)

## Tier 1 — pure/mocked

- **PROP-PACK-001** (REQ-PACK-001, -002; Tier 1) — `src/core/cost-model.ts` re-exports
  `COMMAND_COST_MODEL`/`CostModel` from `cost-model.generated.ts` unchanged: import both modules and
  assert `costModel.COMMAND_COST_MODEL === generated.COMMAND_COST_MODEL` (same object reference — a
  thin re-export, not a copy) OR `deepEqual` if re-exported by value; assert the 18 real command keys
  and their EXACT free/paid values match today's known-correct set (`wallet`/`models`/`dex` → `"free"`,
  the other 15 → `"paid"` — REQ-PACK-NG-001, values unchanged).
- **PROP-PACK-002** (REQ-PACK-005; Tier 1, anti-drift) — independently re-derive the `gatePaidCall(`
  -grep mapping from the REAL `src/commands/*.ts` files, in-test, and assert it is IDENTICAL to
  `cost-model.generated.ts`'s committed `COMMAND_COST_MODEL` — this is the mechanical drift guard
  REQ-PACK-005 requires; it must FAIL if `cost-model.generated.ts` is ever stale relative to the real
  source.

## Tier 2 — live packaged-artifact execution (the regression test for the actual bug)

- **PROP-PACK-003** (REQ-PACK-006; Tier 2, live, $0) — `npm pack` to a fresh temp `--pack-destination`,
  `tar xzf` the resulting `.tgz` into a fresh temp directory, then `spawnSync("node", ["dist/index.js",
  "--version"], { cwd: <extracted package dir> })` and the SAME for `["dist/index.js", "commands",
  "--json"]` — BOTH asserted `status === 0`. This is a REAL npm-pack artifact laid out exactly as `npm
  install`/`npx` would (no symlink into the repo checkout, unlike `npm install -g .` — the exact
  distinction whose absence let the original bug ship undetected).

## Traceability

8 REQ (6 numbered feature REQs + REQ-PACK-007/008 cross-cutting) map to 3 PROPs. REQ-PACK-003/004
(the prebuild wiring + commit-vs-gitignore decision) are structural/build-process requirements verified
by PROP-PACK-003 succeeding at all (a stale/missing generated file would make `npm run build`'s output
either fail to build or reproduce the ORIGINAL crash) — not a separate dedicated PROP. REQ-PACK-007
(regression) is satisfied by the ongoing `npm test` gate; REQ-PACK-008 (execution-notes honesty record)
has no PROP — it's a documentation REQ, verified by direct review at converge.
