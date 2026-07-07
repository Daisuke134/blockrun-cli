# Spec Review Findings — iteration 1 (adversary: fresh-context, model: Opus 4.8)

Verdict: overall FAIL — spec_fidelity PASS / verification_readiness FAIL (1 blocking, 0 major, 6 minor).
(Adversary agent could not write files in its environment; findings transcribed verbatim by orchestrator from its report.)

## Finding 1 — BLOCKING (verification_readiness)
verification-architecture.md contradicts itself on the real-money video E2E path. §2.2's per-command table says PROP-115 = "real minimal call (shortest allowed duration on the cheapest model)". §4.3's per-command minimum-cost-real-path table says for video: "cheapest model at its documented default duration (do not attempt to force a shorter-than-default duration untested against upstream)" — priced at ~$0.40 for the 8s default on xai/grok-imagine-video (confirmed against the clone's VIDEO_DEFAULT_DURATION map). Since duration_seconds is zod min(1).max(60), "shortest allowed" literally means 1 second — the exact thing §4.3 explicitly forbids. Tier-3 spends real USDC on Base mainnet under a $10 cap, and the two sections direct two different real-money actions for the same test.
Required fix: reconcile PROP-115 and §4.3 into one rule.
Orchestrator resolution directive: quote-gated design — request cheapest model, duration_seconds=1, 360p; sign only if the 402 quote ≤ $0.10; otherwise record quote in ledger and fall back to documented-default duration after remaining-budget check (>= quote + $0.20 headroom).

## Finding 2 — MINOR (spec_fidelity)
REQ-179 says SURF_T2_PATHS has "18 exact paths" — actual Set in surf.ts:41-61 has 19 entries. (PROP-152 correctly ports the real constant; the count is wrong.)

## Finding 3 — MINOR
REQ-020 enumerates cost-estimator functions to run before every paid call but omits speechCost (speech.ts:54-58), though REQ-151 depends on it and verification-architecture.md §1.1 lists it as a ported module.

## Finding 4 — MINOR
REQ-146 ("music failure/timeout SHALL NOT charge") misses an edge case: music.ts:190-196 — the inline-success branch DOES call recordActualSpend when a payment receipt header is present but track.url is missing (receipt proves on-chain settlement). Disclose in the REQ.

## Finding 5 — MINOR
REQ-137/138 (realface) don't mention the zod .min(1).max(64) constraint on --name (realface.ts:101).

## Finding 6 — MINOR
REQ-137's "<https url>" framing for --image-url overstates enforcement — zod validator is generic z.string().url() (any scheme); https is doc-level convention. Risk: over-strict rejection of valid http:// URLs.

## Finding 7 — MINOR
REQ-132 (video) doesn't capture that --model azure/sora-2 requires duration_seconds ∈ {4,8,12} (video.ts:66, description-only constraint) — surface in CLI --help per REQ-013 precedent.

## Open design questions (§6) — adversary assessment
1. Budget persistence deferral: acceptable, not blocking.
2. realface enroll liveness (17/18 automated + 1 flagged): sound, consistent with honesty/no-dry-run rules; needs explicit product sign-off before Tier-3 "done". → Orchestrator sign-off GRANTED (goal's 高額・不可逆パス代替 clause; liveness-impossible same class); to be restated as decided rule.
3. CLI JSON-arg library deferred to Phase 2: correctly scoped, not blocking.
