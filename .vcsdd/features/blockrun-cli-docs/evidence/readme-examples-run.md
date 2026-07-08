# README command examples — first-hand execution log (orchestrator / Claude Code)

Date: 2026-07-08. Binary: `blockrun` via `npm install -g .` (`/opt/homebrew/bin/blockrun`), plus
`node dist/index.js` equivalences. Wallet-mutating examples ran in a throwaway `HOME=/tmp/blockrun-readme-check`
(created + deleted same session) so the shared `~/.blockrun` and the e2e sandbox stayed untouched.

| README example | Where run | Result |
|---|---|---|
| `git clone … && npm install && npm run build` | repo (pre-existing build) | dist/index.js present, `npm install -g .` succeeded |
| `node dist/index.js wallet --action status` | fresh throwaway HOME | onboarding rendered: new Base wallet auto-generated (`0x57a8…7E34`), funding instructions + basescan link, exit 0 |
| `blockrun wallet --action status` | throwaway HOME | same as above via global bin |
| `blockrun wallet --action chain --chain solana` | throwaway HOME | Solana wallet provisioned (`EkgG…8wdA`), active chain switched to SOLANA |
| `blockrun wallet --action setup` | throwaway HOME | funding address + `qr.png` saved, exit 0 |
| `blockrun price --action price --category crypto --symbol BTC-USD --json` | e2e sandbox HOME | real Pyth quote (feedId `0xe62df6c8…`), $0 |
| `blockrun models --category chat --json` | e2e sandbox HOME | count: 55, $0 |
| `blockrun dex --query SOL --json` | e2e sandbox HOME | 10 real DexScreener pairs, $0 |
| `blockrun video --help` | e2e sandbox HOME | usage rendered, exit 0 |
| `blockrun chat "what is the capital of France?" --mode free` | e2e sandbox HOME | `[nvidia/llama-4-maverick] The capital of France is Paris.`, $0 |

Paid examples in the README reuse the exact invocations proven in VERIFICATION.md (rows #12–#17) and the
2026-07-08 fresh media re-runs (evidence/image.json, video.json, music.json) — not re-executed a second time
here to avoid double-spend, per DOC-PARITY-006.

All 18 subcommand `--help` screens: verified exit 0 + non-empty earlier this session (precheck agent report,
re-verified mechanically by scripts/docs-check.mjs on every run).

Known finding at time of writing: `blockrun --version` returned `0.1.0` (hardcoded literal in src/index.ts:89)
vs package.json 1.0.0 — resolved via the narrowly-scoped one-line version-literal exception recorded in the
spec (PROP-016b) and execution-notes.md.
