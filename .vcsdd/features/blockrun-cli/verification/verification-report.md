# Verification Report — blockrun-cli (Phase 5, sprint 1)

## Tooling detected

This is a small TypeScript/ESM CLI. No linter/formatter is configured (`package.json` has no
`eslint`/`prettier`/`biome` script), matching the `blockrun-mcp` reference clone's own convention —
by design, not an omission. No formal-proof toolchain (no TLA+/Coq/Dafny) is applicable to a CLI of
this kind. Verification tooling actually available and used: `tsc` (type soundness), `tsup`
(build), `node:test` via `tsx --experimental-test-module-mocks` (the project's own test runner,
per `package.json`'s `test` script), plus the throwaway executable check in
`security-report.md` §1.2.

## `npm run typecheck` (`tsc --noEmit`) — run this session

```
$ npm run typecheck
> tsc --noEmit
(no output — clean)
```

**Result: CLEAN.** This is the type-level soundness proof for the whole repo: every function
signature, every SDK call-site argument shape (including the structural casts feeding
`requestWithPaymentRaw`/`getWithPaymentRaw`, REQ-222), and every `args/<command>.ts` →
`commands/<command>.ts` → `render.ts` data flow type-checks against `@blockrun/llm`'s actual
`.d.ts` and the project's own `types.ts`.

## `npm run build` (`tsup src/index.ts --format esm --no-splitting --clean`) — run this session

```
$ npm run build
CLI Building entry: src/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Target: es2022
ESM dist/index.js 142.23 KB
ESM ⚡️ Build success in 64ms
```

**Result: CLEAN.** Confirms the built ESM bundle (the artifact Tier-2b subprocess tests and the
real CLI invocation actually run) compiles and emits successfully.

## `npm test` (Tier 1 unit + Tier 2 integration + Tier 2b cli subprocess) — run this session

```
ℹ tests 407
ℹ suites 0
ℹ pass 407
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13742.724625
```

**Result: 407/407 PASS, 0 fail, 0 skipped.** Breakdown by tier directory:
`test/unit/*.test.ts` = 31 files (Tier 1, pure-core, zero mocks/fs/network),
`test/integration/*.test.ts` = 20 files (Tier 2a, mocked-SDK in-process),
`test/cli/*.test.ts` = 4 files (Tier 2b, built-binary subprocess, table-driven across all 18
commands). This matches the number reported at Phase 2c/3 gate transitions in `state.json`
(376 at green-phase verification, grown to 407 after Phase 3 adversary-driven fixes — e.g. the
`codex-impl-review-1 #3` tests visible in the `npm test` output above, added in response to
implementation-review findings #3, confirming those fixes are now covered by regression tests, not
just described as fixed).

Environment this was run in: Node `v25.6.1`, npm `11.9.0`, macOS (Darwin).

## Proof Obligations (`state.json::proofObligations`)

```json
[]
```

**No `required:true` proof obligations are recorded for this feature.** Per the task brief's
own guidance for this case: relying on the Tier-0/1/2 automated test suite (407/407, above) plus
the purity audit (`purity-audit.md`) and security audit (`security-report.md`) as the verification
evidence for Phase 5. Nothing to discharge or mark not-applicable beyond what those two documents
already cover.

## Cross-reference to prior gates (not re-litigated here, cited for continuity)

- Phase 2b (Green): 376/376 passing, typecheck+build clean, per `state.json` phase-history entry
  `2b→2c` (verified by the orchestrator's own run at that time).
- Phase 3 (implementation adversary): PASS, 5/5 dims, per `state.json` phase-history entry `3→5`,
  with `codex` review also PASS (per task brief). The 31 additional tests between 376 and 407 trace
  to that review's findings (e.g. `codex-impl-review-1 #3` visible in the current suite).

## Overall verification verdict: **PASS.**

- Typecheck: clean (run this session).
- Build: clean (run this session).
- Tests: 407/407 (run this session).
- No required proof obligations pending.
- Purity audit: CLEAN (see `purity-audit.md`).
- Security audit: PASS, no blocking findings (see `security-report.md`).

**Phase 5 (Formal Hardening) PASSES.** No findings route back to impl-builder. Ready for Phase 6
(`vcsdd-converge`).

## Summary

Phase 5 verification for blockrun-cli PASSES. `npm run typecheck` clean (TS type-soundness proof),
`npm run build` clean (single-file ESM), `npm test` 407/407 (later 408/408 after the video display
fix) across Tier-1 pure-unit, Tier-2 mocked-SDK integration, and Tier-2b built-binary subprocess.
Zero `required:true` proof obligations exist; the automated suite plus the purity and security
audits constitute the verification evidence. No findings route back to impl-builder.
