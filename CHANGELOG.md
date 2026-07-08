# Changelog

All notable changes to blockrun-cli will be documented in this file.

## 1.1.0

- **`blockrun commands [--json]` — machine-readable command catalog.** Lists all 18 subcommands as
  `{ name, description, costModel, flags }`, with `flags` derived by introspecting each command's real
  zod schema at runtime (never a hand-maintained duplicate). `--json` for automation, a concise
  human table otherwise. Free, no wallet/network call.
- **Machine-readable error `code` + exit codes.** `--json` error output gains an optional `code` field
  (`usage_error`/`budget_exceeded`/`quote_exceeded`/`insufficient_funds`/`upstream_error`/
  `network_error`) alongside the existing `message`, and process exit codes now follow a gh/curl
  -inspired convention: `0` success, `2` usage/budget problems, `3` payment/quote problems, `4`
  upstream/network problems, `1` for anything unclassified (today's universal default, unchanged).
  Purely additive — `message`'s content/meaning is unchanged for every existing case.
- **`wallet`'s `balanceUnavailableReason` — why a balance came back null, not just that it did.** The
  `status` action's per-chain `base`/`solana` objects and the `chain` action's `activeBalance` now
  explain a `null` balance (`all_rpcs_failed` for Base, `solana_client_error` for Solana), present ONLY
  when the balance is actually unavailable — never alongside a real balance, including a genuine `0`.

## 1.0.0

- **`wallet` — status, chain switching, budget delegation, and a persisted cross-process ledger.** All 9 actions (status/deposit/setup/qr/chain/budget/delegate/revoke/report) ported 1:1 from blockrun-mcp's `blockrun_wallet`. Unlike the MCP server's in-memory budget state, this CLI persists spend to `~/.blockrun/cli-budget.json` so `delegate`/`revoke`/`report` work correctly across separate one-shot invocations — proven cross-process in `VERIFICATION.md` row #1.
- **`chat` — 55+ LLMs via mode/model/smart-routing.** Full parameter surface ported from `blockrun_chat`, including a bare positional alias (`blockrun chat "hi"` == `blockrun chat --message "hi"`) and `--thinking`/`--thinking-budget-tokens` for Anthropic extended thinking on `anthropic/claude-*` models.
- **`models` — live model catalogue with pricing.** Free, filterable by `--category`/`--provider`.
- **`image`/`video`/`music`/`speech`/`realface` — the 5 media generation commands.** Full parameter surfaces ported from their source tools, including quote-gated `video --max-quote-usd` (a CLI-only safety flag: abort BEFORE any payment signature is produced if the real 402 quote exceeds a caller-set cap) and RealFace's phone-liveness enrollment flow (`init`/`status`/`enroll`) plus the no-liveness `portrait` path for AI-generated characters.
- **`markets`/`price`/`dex`/`rpc`/`defi`/`surf`/`search`/`exa`/`modal`/`phone` — the 10 data and passthrough commands.** The path-based tools (`markets`/`surf`/`rpc`/`defi`/`modal`/`phone`/`exa`/`search`) accept `--path`/`--params`/`--body` verbatim, mirroring each source tool's passthrough shape 1:1; `search`/`exa` additionally expose ergonomic alias flags (`--query`, `--max-results`, etc.) that compile into the same request body as `--body`.
- **Budget safety — three independent layers.** A per-invocation ephemeral `--budget-limit` flag (never persisted), a persisted cross-process ledger at `~/.blockrun/cli-budget.json` (global + per-agent caps), and — for `video` specifically — a real-quote gate (`--max-quote-usd`) that re-validates the actual 402-quoted price against the cap before any signature is produced.
- **`--json`/`--help` — machine-readable and human-readable output contracts.** Every command supports `--json` for a single machine-readable JSON document on stdout (logs/progress go to stderr) and a concise `--help` with cost notes for tiered/fixed pricing.
- **E2E verification — 18/18 commands live-tested against the real BlockRun API.** Real x402 USDC settlements on Base mainnet, ≈$0.325 total spend against a $10 goal cap — see `VERIFICATION.md` for the full evidence ledger (response IDs, transaction hashes, and artifact checksums).
