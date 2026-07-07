# blockrun-cli — Tier-3 E2E Verification Ledger

All 18 blockrun-mcp tools were invoked as `blockrun` CLI subcommands against the REAL BlockRun API (no mocks, no dry runs) from the built binary `dist/index.js`. Paid tools settled real x402 USDC micropayments on Base mainnet.

## Environment
- Binary: `dist/index.js` (tsup ESM build), run as `node dist/index.js <cmd>`
- Sandbox HOME: `/Users/anicca/blockrun-cli-e2e-home` (hermetic per REQ-017 — spawned with HOME set; SDK reads os.homedir())
- Active chain: base
- Wallet (SDK auto-generated under sandbox HOME): Base `0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804`, Solana `HxeDzzgrMjZFnqqrEj6iZyiqx3XbeQ2Ke4ZcgdSshLZm`
- Funding: 0.59 USDC to the Base address, tx `0xccbaf5adeb67e2e144be9dd091b9533a951eb7c2ea5189dff0a02e0d33f4bbe3` (from treasury 0x810f)
- Start $0.59 -> end $0.2747 -> total real spend ~ $0.315 (inside the $10 cap and $0.59 funded)

## Ledger — 18/18 PASS

| # | Command | Real path | Primary evidence | Cost USD | Result |
|---|---------|-----------|------------------|----------|--------|
| 1 | wallet | status -> chain -> delegate(agent e2e-test, 0.05) -> report (4 SEPARATE invocations) | report shows delegation persisted across processes: agents.e2e-test={limit:0.05,spent:0,calls:0} in ~/.blockrun/cli-budget.json (REQ-019/PROP-103) | 0 free | PASS |
| 2 | models | default list | 74 models returned | 0 free | PASS |
| 3 | dex | --query SOL | real DexScreener pairs (base/aerodrome) | 0 free | PASS |
| 4 | price | --action price --category crypto --symbol BTC-USD | Pyth feed price 63986.997, feedId 0xe62df6, publishTime present | 0 free | PASS |
| 5 | chat | --mode free --message "2+2?" | {model_used:nvidia/llama-4-maverick, response:"4"} | 0 free | PASS |
| 6 | defi | --path prices/coingecko:bitcoin | {coins:{coingecko:bitcoin:{price:63889.65}}} | ~0.001 | PASS |
| 7 | surf | --path market/price --params {symbol:BTC} | asksurf MarketPriceResponse, real BTC series | ~0.001 | PASS |
| 8 | markets | --path polymarket/events | real Polymarket events | ~0.001 | PASS |
| 9 | rpc | --network base --method eth_blockNumber | {id:1,jsonrpc:2.0,result:0x2e16c6b} real Base block | ~0.002 | PASS |
| 10 | exa | --path contents --body {urls:[https://blockrun.ai]} | requestId 518dbb4e, real page content | ~0.002 | PASS |
| 11 | search | --query "blockrun ai gateway" --max-results 1 | Grok live-search summary returned | ~0.025 | PASS |
| 12 | modal | sandbox/create -> status -> terminate | sb-C1EZrJXCKY2X40cDw9PGeu: running -> running -> terminated | ~0.012 | PASS |
| 13 | image | --model zai/cogview-4 --prompt "a red cube on white background" | real PNG at media URL; downloaded 1024x1024, MD5 dc8a4cad2060539d2cb33392082031c3; cost_usd 0.015 | 0.015 | PASS |
| 14 | speech | --action speak --input "hi" | {format:mp3, model:elevenlabs/flash-v2.5, cost_usd:0.001, txHash:0xd8184055ef5999b21dd5ea33209396d5726d6e50bc45fea273267ed56b285815} | 0.001 | PASS |
| 15 | music | --prompt "chill lo-fi beats" | 84s mp3, minimax/music-2.5+, cost_usd 0.1575, txHash 0xaf974e98fe8183a311c7a37ad68a08cf701ecee727498c4351dd301115e5eeac | 0.1575 | PASS |
| 16 | video | --model xai/grok-imagine-video --duration-seconds 1 --resolution 360p --max-quote-usd 0.10 | quote-gate PRIMARY: 402 quote 0.0525<=0.10 -> signed -> 1s mp4, cost_usd 0.052501, txHash 0xa4625b8102c223d7733bf3d1a92a95769da7eb87d7992df5b6ef48d28f256c42 | 0.0525 | PASS |
| 16b | video abort | same, --max-quote-usd 0.001 | quote-gate ABORT: quote 0.0525>cap -> aborted before signing, exit 1, balance UNCHANGED (no charge). Proves REQ-135a. Note: error rounds cap to 0.00 (cosmetic display bug, tracked; gate correct) | 0 aborted | PASS |
| 17 | realface | init (liveness h5_link = untested-enroll path, sec 4.4) -> list free -> portrait(name, AI face url) | portrait asset ta_c97289c307c2430f8c3e5e1c75694c05, group legacy_rf_17921, price_usd 0.01 (first attempt transient upstream 502; retry succeeded — recorded honestly) | 0.01 | PASS |
| 18 | phone | --path phone/numbers/list --body {} | {numbers:[],count:0} real account query | ~0.001 | PASS |

## Untested-for-cost/human-reasons (documented, not hidden — spec sec 4.4)
- phone numbers/buy ($5) / voice/call ($0.54): high-cost; covered via cheapest same-tool path numbers/list. UNTESTED.
- realface enroll: requires live human liveness (BytePlus h5_link, blink/scan) — un-scriptable. init returned the real liveness link (path wired); human-liveness completion UNTESTED by design (sec 6.1). portrait (AI-image, $0.01) covers realface paid E2E.
- video documented-default 8s fallback (~$0.40): only if 1s primary quote > $0.10; primary quoted 0.0525 and succeeded, fallback not reached. UNTESTED.

## Provenance
Raw stdout/stderr per command saved under /Users/anicca/blockrun-cli-e2e-out/ at run time. Full suite Tier 0/1/2: 407/407 pass, typecheck clean, build clean (.vcsdd/.../evidence/sprint-1-green-phase.log). Phase-3 adversary (Opus) + independent codex review both PASS after fixing 7 money-path findings; Phase-5 hardening purity CLEAN + security PASS (.vcsdd/.../verification/).
