# Verification Report — blockrun-cli-funding-dx (Phase 5)

## Feature: blockrun-cli-funding-dx | Sprint: 1 | Date: 2026-07-08

## Proof Obligations

`proofObligations` in `state.json` is currently an empty array (0 registered) — no formal (Tier 2/3)
proof obligations were registered for this feature in Phase 1b. `specs/verification-architecture.md`
defines 13 PROPs, all Tier 1 (mocked, exercised inside `npm test`) or Tier 2-live-but-mechanical
(free binary smoke checks against the real `blockrun.ai` gateway, not formal-methods tooling). None of
these PROPs were registered as `state.json` `proofObligations[]` entries requiring Kani/Hypothesis/
fast-check-style formal execution, so there is nothing in that array for this phase to prove, fail, or
skip. This is recorded here explicitly per the Phase 5 protocol's "zero required proof obligations"
branch. The PROPs themselves were already exercised as part of Phase 2/3 (`npm test`, 551/551 at the
time) and are re-verified below as part of the regression + live-binary-smoke tracks that substitute
for formal proof execution on this feature.

| ID | Tier | Required | Status | Tool | Artifact |
|----|------|----------|--------|------|---------|
| (none registered) | — | — | — | — | — |

## Results

### Regression suite — `npm test`
- **Command**: `npm test` (`tsx --experimental-test-module-mocks --test test/unit/*.test.ts test/integration/*.test.ts test/cli/*.test.ts`)
- **Result**: PASS ✅
- **Actual counts observed**: `tests 553`, `suites 0`, `pass 553`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, duration 19.7s
- **Note**: the task prompt's "expect 553/553" matched what was actually observed. The phase-history baseline recorded 551/551 as of the Green-phase gate (`2026-07-08T09:21:27Z`); the 2 additional passing tests come from `af27cf5` (`docs(funding-dx): fix stale '532-test suite' wording`), which is a doc/comment fix commit within this feature's own diff range (`eeee0e3..HEAD`), not drift from another feature.

### Typecheck — `npm run typecheck`
- **Command**: `npm run typecheck` (`tsc --noEmit`)
- **Result**: PASS ✅, exit code 0, no output beyond the script banner.

### Docs check — `node scripts/docs-check.mjs`
- **Command**: `node scripts/docs-check.mjs`
- **Result**: PASS ✅ — `18 checks run, 18 PASS, 0 FAIL`, exit code 0.

### Build — `npm run build`
- **Command**: `npm run build` (`tsup src/index.ts --format esm --no-splitting --clean`)
- **Result**: PASS ✅ — `ESM dist/index.js 152.59 KB`, "Build success in 95ms", exit 0. Run before the
  binary smoke tests below to guarantee `dist/index.js` reflects `HEAD` (`af27cf5`), not a stale artifact.

### Live binary smoke test — Base deposit (PROP-FUND-010 equivalent)
- **Command**: `HOME=/tmp/fdx-verify-<pid> node dist/index.js wallet --action deposit --json` (fresh throwaway `$HOME`, no pre-existing `~/.blockrun`)
- **Result**: PASS ✅
  - Fresh Base wallet auto-created: `0x606e2900f1bbEC43E928F33D298B8d8801022Da6` (only `.session` written under `~/.blockrun/` at this point — the wallet's own private-key material, not the funding-dx feature's artifact).
  - `exitCode === 0`.
  - JSON output included `url: "https://pay.coinbase.com/buy/select-asset?sessionToken=...&defaultAsset=USDC&defaultNetwork=base&fiatCurrency=USD"` — a real, live-minted Coinbase Onramp URL (starts with `https://pay.coinbase.com/`), `opened: false` (no `--open` passed, matches REQ-FUND-008 default-off), and the pre-existing `chain`/`address`/`note` fields all present.
  - `curl -sI` against the minted URL returned `HTTP/2 302` with a `location: /landing?...` redirect (Coinbase's own CSP/security headers present) — a real 2xx/3xx confirming the link resolves against Coinbase's live edge, not a fabricated string.
  - **Money-safety check**: `~/.blockrun/cli-budget.json` was **NOT created** at any point during or after this call (`ls -la $HOME/.blockrun/` showed only `.session`, `.chain`, `.solana-session` after the full smoke sequence — no ledger file ever appeared) — confirms `deposit`'s mint path never touches the persisted budget ledger, matching PROP-FUND-006/REQ-FUND-003/-017's "wallet never touches the ephemeral/persisted budget on this path" contract, verified live (not just via the mocked Tier-1 test).

### Live binary smoke test — Solana deposit (PROP-FUND-011 equivalent)
- **Commands** (same throwaway `$HOME` as above, sequential):
  1. `node dist/index.js wallet --action chain --chain solana --json` → `exitCode 0`, `{"activeChain":"solana","base":"0x606e...","solana":"FXeQxEt1CkjFaGJeGmNG1fpfSHgwfjRNisnqJBTCBaX9","activeBalance":0}` — a fresh Solana wallet was created only because `--chain solana` was explicitly requested (REQ-016a).
  2. `node dist/index.js wallet --action deposit --json` → `exitCode 0`, `{"chain":"solana","address":"FXeQxEt1...","note":"Card top-up (Coinbase Onramp) is Base-only. To fund on Solana, run blockrun wallet --action setup for your address + QR (send USDC SPL), or switch with --action chain --chain base."}`.
- **Result**: PASS ✅ — no `url` field present in the JSON output at all (not merely `null`), the `note` explicitly states the Base-only limitation and gives an actionable alternative, `payOnce()` was never invoked (no network call for the mint endpoint occurred — confirmed by the absence of any `pay.coinbase.com` URL or mint-related error text in the output). `cli-budget.json` still absent after this second call.
- **Cleanup**: the throwaway `$HOME` directory was `rm -rf`'d after both smoke sequences; confirmed no `/tmp/fdx-verify-*` directories remain.

## Summary
- Required obligations: 0 (none registered in `state.json`; see note above)
- Proved: 0 (n/a — nothing required)
- Failed: 0
- Skipped: 0
- Regression: 553/553 passing, typecheck clean, docs-check 18/18, build clean, live Base-deposit smoke PASS (real Coinbase URL, 302 resolution, zero ledger writes), live Solana-deposit smoke PASS (no URL, correct Base-only note, zero ledger writes).
- No degradation applied — this feature registered no formal-tier obligations requiring Kani/Hypothesis/fast-check, so there was nothing to degrade from.
