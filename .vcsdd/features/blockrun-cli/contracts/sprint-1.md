---
sprintNumber: 1
feature: blockrun-cli
scope: >
  Full v1 implementation of blockrun-cli: all 18 blockrun-mcp v0.28.0 tools as 1:1
  subcommands (spec v4, REQ-001..REQ-222 / 131 REQs), pure-core + impure-shell split,
  commander CLI, @blockrun/llm 2.13.0 wrapping (no signing reimplementation), persisted
  cli-budget.json ledger, quote-gated payments, 4-layer test taxonomy (tier 0-2 in-suite,
  tier 3 real-API E2E at Phase 5).
criteria:
  - id: CRIT-001
    dimension: spec_fidelity
    description: Every command's canonical parameter surface, enums, defaults, aliases and conflict rules match behavioral-spec.md §2 exactly, which itself is line-cited to the blockrun-mcp clone; no REQ silently unimplemented or deviated without a recorded decision.
    weight: 0.25
    passThreshold: Zero blocking spec-conformance findings after adversary spot-checks at least 6 commands (mix of typed/path-based/free/manual-x402) against spec and clone.
  - id: CRIT-002
    dimension: edge_case_coverage
    description: Alias/positional conflicts, budget cap interactions (ephemeral flag vs persisted ledger vs --max-quote-usd), path-safety, SSRF guards, 402-quote re-validation, and payment-failure no-charge paths all have tests that would fail if the behavior regressed.
    weight: 0.2
    passThreshold: Zero blocking coverage gaps on money-touching or security-relevant paths; minor gaps documented.
  - id: CRIT-003
    dimension: implementation_correctness
    description: Full suite green (376/376 at contract time), typecheck and build clean, ported logic (cost estimators, budget math, error classification, x402 flows) faithful to the clone's semantics.
    weight: 0.25
    passThreshold: All tests pass on adversary's own re-run; zero blocking correctness findings; any discovered divergence from clone semantics is either fixed or recorded as a deliberate, spec-cited adaptation.
  - id: CRIT-004
    dimension: structural_integrity
    description: blockrun-mcp conventions held (ESM with .js imports, kebab-case, 1 command = 1 file, files <800 lines, no linter/formatter additions, comments explain why); purity boundary (pure core vs impure shell) respected with no network/fs in core.
    weight: 0.15
    passThreshold: Zero blocking structural violations; the pure core imports no node:fs/node:net/undici/SDK modules.
  - id: CRIT-005
    dimension: verification_readiness
    description: Tier-3 E2E plan is executable exactly as spec'd (HOME-sandbox isolation, ledger columns incl. chain/wallet/HOME, per-command minimum-cost paths, quote gates) against the built dist/index.js.
    weight: 0.15
    passThreshold: Adversary confirms each tier-3 row in verification-architecture.md §4.3 maps to a runnable command against the built binary with no missing mechanism.
negotiationRound: 0
status: approved
---

# Sprint 1 Contract — blockrun-cli v1

Grading criteria for the Phase 3 adversary review are defined in the frontmatter
(CRIT-001..CRIT-005, canonical five dimensions). Approval: orchestrator (standing
no-human-loop mandate; adversary grades against this contract at Phase 3 and its
verdict gates Phase 5).

Evidence at contract time: `evidence/sprint-1-green-phase.log` (376/376 pass,
typecheck+build clean, verified by an independent orchestrator run), red-phase
evidence `evidence/sprint-1-red-phase.log` (159 failing before implementation,
earlier 157-count superseded), harness-fix log
`evidence/sprint-1-harness-fixes-and-delta-red.log`.
