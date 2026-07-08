# blockrun-cli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Real-time markets, research, web search, and crypto data — from the command line. No API keys. Pay
per call.**

`blockrun-cli` wraps all 18 [BlockRun](https://blockrun.ai) tools (the same ones exposed by the
[`blockrun-mcp`](https://github.com/blockrunai/blockrun-mcp) MCP server) as `blockrun` subcommands,
backed by `@blockrun/llm`. Each call is billed in fractions of a cent, settled in USDC on Base or
Solana via [x402](https://x402.org) micropayments — no subscriptions, no API dashboards.

Built for **Claude Code**: run `blockrun <command>` from Claude Code's Bash tool to give an agent the
same real-time data access an MCP registration would, via a plain shell command instead of an
in-process tool call. Works equally well from any other agent or script with shell access.

## Prerequisites

- **Node.js ≥ 20.19** (`node -v`)
- **A few dollars of USDC** on Base or Solana (a wallet auto-creates on first run; see
  [Fund your wallet](#fund-your-wallet))

## Install

```bash
npm install -g blockrun-cli
blockrun wallet --action status
```

Or run it without installing anything:

```bash
npx -y blockrun-cli wallet --action status
```

**For development** — install from source instead:

```bash
git clone https://github.com/Daisuke134/blockrun-cli
cd blockrun-cli
npm install
npm run build
node dist/index.js wallet --action status
```

## Fund your wallet

Run `blockrun wallet` (defaults to `--action status`) to see your addresses on both chains. The CLI
pays on **Base** by default. Send USDC on Base to the address it prints.

Prefer Solana? Switch the active chain — no env vars, no restart:

```bash
blockrun wallet --action chain --chain solana
blockrun wallet --action setup
```

Then send USDC (SPL) on **Solana** to the address it shows. Switch back anytime with
`blockrun wallet --action chain --chain base`. The CLI keeps both wallets; switching just changes
which one pays.

## Commands

| Command | What it does | Cost |
|---|---|---|
| `blockrun wallet` | Balances, active chain, spend budgets, agent delegation | Free |
| `blockrun chat` | Chat with 55+ AI models via mode/model/smart-routing | $0 on `mode=free`/`nvidia/*`; else per-model |
| `blockrun models` | List available AI models with pricing | Free |
| `blockrun image` | Generate or edit images | $0.015–$0.15/image |
| `blockrun video` | Generate a short AI video | $0.05–$0.30/sec |
| `blockrun realface` | Enroll a real/AI face as a RealFace asset for `video` | init/status/list free; enroll/portrait $0.01 |
| `blockrun music` | Generate a ~3min music track | Flat $0.1575 |
| `blockrun speech` | Text-to-speech, sound effects, or list voices | `voices` free; else per-char/effect |
| `blockrun search` | Grok Live Search — real-time web/X/news | $0.025 × max-results (default 10 → $0.25) |
| `blockrun exa` | Neural web search via Exa | $0.01/call flat, `contents` $0.002/url |
| `blockrun markets` | Prediction market + derivatives data (Predexon) | $0.001–$0.005/call |
| `blockrun price` | Quotes/history for crypto, FX, commodities, stocks | Free except stocks ($0.001) |
| `blockrun dex` | DEX pairs via DexScreener | Free |
| `blockrun rpc` | Raw JSON-RPC across 40+ chains | $0.002/call (batch charges per element) |
| `blockrun defi` | DefiLlama TVL/yields/prices | $0.001 (prices) or $0.005 |
| `blockrun modal` | Run code in a disposable Modal sandbox | $0.01 create, $0.001 exec/status/terminate |
| `blockrun phone` | Phone intelligence, number provisioning, AI voice calls | $0–$5.54 by path |
| `blockrun surf` | Unified crypto data (asksurf.ai), 84 endpoints | $0.001/$0.005/$0.02 tiers |
| `blockrun commands` | List all subcommands as a machine-readable catalog: name, description, cost model, flags | Free |

## Machine-readable errors: `code` and exit codes

Every `--json` error output gains an optional `code` field (`{"error":true,"code":"...","message":"..."}`)
when the failure matches one of these 6 classes — `message`'s content and meaning are unchanged either
way, and `code` is simply omitted for anything not in this list:

| `code` | Meaning | Exit code |
|---|---|---|
| `usage_error` | Malformed, missing, or conflicting CLI input — rejected locally before any network call | `2` |
| `budget_exceeded` | A `--budget-limit` or persisted (`~/.blockrun/cli-budget.json`) spend cap was hit before any network call | `2` |
| `quote_exceeded` | A real 402-quoted price was rejected (`--max-quote-usd`, or the budget re-check) AFTER a quote but BEFORE any payment signature | `3` |
| `insufficient_funds` | A real x402 settlement attempt was rejected for balance/payment reasons | `3` |
| `upstream_error` | The model/provider is temporarily unavailable, or returned a server error | `4` |
| `network_error` | A raw connection/DNS/timeout failure occurred before any HTTP response was received | `4` |
| _(omitted)_ | Any other failure — unclassified | `1` |

A successful call always exits `0`.

## Usage examples

Every command supports `--json` for a single machine-readable JSON document on stdout (all logs go to
stderr), and `--help` for its full flag list with cost notes:

```bash
# Machine-readable output
blockrun price --action price --category crypto --symbol BTC-USD --json
# {"symbol":"BTC-USD","price":63986.997,"publishTime":1783444867,...}

blockrun models --category chat --json
blockrun dex --query SOL --json

# Human-readable help for any command, including cost/enum notes
blockrun video --help
```

A bare positional argument works as a shorthand for the main text field on `chat`/`image`/`video`/
`music`/`speech`:

```bash
blockrun chat "what is the capital of France?" --mode free
```

## Multi-agent budget delegation

Two independent safety layers, both CLI-only additions over the underlying `@blockrun/llm` SDK:

- **`--budget-limit <usd>`** — caps ONLY the current invocation's paid call(s). Ephemeral: never read
  from or written to disk, checked in-process for the lifetime of that one command.
- **Persisted cross-process ledger** — `blockrun wallet --action delegate --agent-id <id> --agent-limit
  <usd>` allocates a spending cap to a named agent, written to `~/.blockrun/cli-budget.json`. Every
  subsequent paid command run with `--agent-id <id>` is checked and metered against that SAME
  persisted cap, even across separate one-shot processes — useful when spawning multiple agent
  sub-processes that shouldn't collectively overspend. Check spend with
  `blockrun wallet --action report`; remove the cap with `blockrun wallet --action revoke --agent-id
  <id>`.

## Troubleshooting

- **`Insufficient balance` / HTTP 402** — the active chain's wallet is empty. Run
  `blockrun wallet --action setup` for a funding address and QR code.
- **Wrong active chain** — check with `blockrun wallet --action status`; switch with
  `blockrun wallet --action chain --chain base` (or `solana`).
- **`--path`/`--network` rejected with a validation error, no network call made** — the path-based
  commands (`markets`/`surf`/`rpc`/`defi`/`modal`/`phone`/`exa`/`search`) and `rpc`'s `--network` flag
  reject a malformed value (a `.`/`..` path segment, or a non-`[a-z0-9-]+` network slug) locally,
  before any request or spend — this is a safety check, not a bug; pass a well-formed path/slug.
- **`video`'s real 402 quote exceeds your cap** — pass `--max-quote-usd <usd>` up front to abort BEFORE
  any payment signature is produced if the real quote comes in over your limit.

## Environment Variables

| Variable / File | Default | Effect |
|---|---|---|
| `BLOCKRUN_BUDGET_LIMIT` | unset | Seeds the persisted ledger's global cap the FIRST time `~/.blockrun/cli-budget.json` is created; has no effect once that file already exists. |
| `~/.blockrun/.session` | auto-created on first run | Base EVM private key. File exists → Base wallet available. |
| `~/.blockrun/.chain` | unset | Explicit chain preference: `base` or `solana`. Highest-priority signal in chain resolution. |
| `~/.blockrun/payment-chain` | unset | Alias for `~/.blockrun/.chain` — same precedence. |
| `~/.blockrun/.solana-session` | not created until Solana is selected | Solana private key. |
| `SOLANA_WALLET_KEY` | unset | Env-var override — if present, resolves the active chain to Solana. |

Chain resolution order: `~/.blockrun/.chain` or `~/.blockrun/payment-chain` (if set) → `SOLANA_WALLET_KEY`
env var (if present) → `~/.blockrun/.solana-session` exists → otherwise Base.

## How it works

Pay-per-call via [x402](https://x402.org) micropayments in USDC on Base or Solana. Your wallet lives
at `~/.blockrun/.session` (Base) or `~/.blockrun/.solana-session` (Solana) — the private key never
leaves your machine. Every paid command validates a cost estimate locally, checks it against your
budget caps, makes the call, and settles on success; a failed or timed-out media generation is never
charged.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, the command-design rule, and how to
add a new command.

## License

[MIT](./LICENSE)
