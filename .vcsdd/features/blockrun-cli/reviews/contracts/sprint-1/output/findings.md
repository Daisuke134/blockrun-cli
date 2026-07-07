# Sprint-1 Contract Review — Advisory Findings (adversary: fresh Opus; transcribed by orchestrator due to subagent write-block)

All ADVISORY — attached to NO dimension; overall verdict PASS.

- FIND-001 (Medium, edge_case_coverage-related): CRIT-002 omits the concurrent-CLI TOCTOU race on ~/.blockrun/cli-budget.json (two processes can both pass spent+estimate<=limit and jointly exceed the cap; REQ-019b atomic write prevents corruption, not read-then-write exclusion). Recommend: state it in CRIT-002 or record as an accepted v1 limitation.
- FIND-002 (Low, spec_fidelity-related): CRIT-001's "mix of 6 commands" spot-check can technically exclude all 4 manual-x402 commands. Recommend: make video/music/speech/realface mandatory + ≥2 others.
- FIND-003 (Low, implementation_correctness-related): contract passThreshold does not explicitly require Tier-2 mocks to assert received-call argument shapes (PROPs do). Recommend: add to CRIT-003.
- FIND-004 (Medium, process-integrity): reviewer could not independently reproduce the contractDigest from raw SHA-256 variants. Resolution (orchestrator): digest is computed by vcsdd-state.js computeSprintContractReviewDigest() (normalized), the same function the gate validator uses — method now documented here.

Orchestrator disposition: FIND-001 → recorded as accepted v1 limitation (single-user CLI; ledger race window is milliseconds; revisit post-v1). FIND-002/003 → folded into Phase 3 adversary instructions (mandatory manual-x402 coverage + mock-argument-shape checks). FIND-004 → resolved above.
