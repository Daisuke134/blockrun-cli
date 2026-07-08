# blockrun-cli — execution notes

Goal: blockrun-mcp v0.28.0 の全18ツールを 1:1 で CLI 化、実API E2E 検証つき。
Source of truth: /goal (session)。VCSDD state = .vcsdd/。

## State
- [x] repo 作成 + push (github.com/Daisuke134/blockrun-cli)
- [x] VCSDD init(strict) / spec v4 (REQ131/PROP74) / spec-review PASS (adversary Opus it-3: 0 blocking + codex r3 ok:true 収束済) / tdd RED (157 fail / 0 pass, evidence log有)
- [x] impl (Green) 407/407 + Phase 3 adversary review PASS (Opus iter-2 5/5 + codex round-2 ok:true、money-path blocking 7件 fix済)
- [>] harden (Phase 5) → E2E 18/18 → converge (Phase 6)
- [~] E2E 資金: Aave v3 Base withdraw 実行 (tx 0xb18b779759beda51a4d8397cfc098a0f12985339d1176e8a5383893396cd3489, status 0x1) → 0x810f Base USDC = $0.595。E2E最小 ≈$0.30 (video 1s $0.05 + music $0.1575 + search max_results=1 $0.025 + image $0.015 + 他 ≈$0.05) の2倍。不足時のみ POL 7.1 (Polygon) を bridge（予備）。Polymarket $19.26 は未証明経路のため不使用
- [ ] E2E 18/18 + VERIFICATION.md

## Decisions
- 言語 TypeScript（org 全体 TS 主力、CONTRIBUTING.md が TS 前提）
- @blockrun/llm SDK を wrap、x402/wallet 再実装しない
- CLI-Anything は方法論のみ採用（--json、4層テスト）。Python 生成物不採用
- npm publish しない（repo 公開まで）
- 参照 clone: blockrun-mcp = scratchpad/blockrun-mcp (v0.28.0)

## Review trail
- spec iteration-1: adversary(Opus) FAIL (1 blocking: video E2E矛盾) → fixed
- spec iteration-2: adversary(Opus) PASS (0 findings)
- codex-review-1 (gpt系独立視点): ok:false, blocking 5 (BLOCKRUN_HOME矛盾 / search非1:1 / budgetフラグ未定義 / wallet delegate永続性 / video quote-gate機構欠如) → spec v3 修正中。Opus adversary が見逃したものを別モデルが検出 = 多視点レビューの実証

## E2E 準備 (Phase 5 用)
- sandbox HOME = /Users/anicca/blockrun-cli-e2e-home、wallet Base=0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804 / Sol=HxeDzzgrMjZFnqqrEj6iZyiqx3XbeQ2Ke4ZcgdSshLZm
- 資金: $0.59 USDC 送金済 tx 0xccbaf5adeb67e2e144be9dd091b9533a951eb7c2ea5189dff0a02e0d33f4bbe3 (from 0x810f)。予備=POL 7.1 bridge
- 実機観測の異常2件（--json初回のonboarding漏れ / fresh環境でactiveChain=solana）→ impl-adversary に検証依頼済み

## Evidence log
- ~/.blockrun/.session EVM addr = 0xAaD274758048A133C78b7Ac518aD2e46912e262c (Base USDC 0)
- 0x810f6d61f7606deee2657d3083e150a222bc29c5 Base USDC = $0.2797, ETH 1.37e13 wei
- MCP npx cache 破損確認 (@solana/web3.js 欠落) — CLI の存在意義の実例

## blockrun-cli-docs (2026-07-08)

Goal: BlockRun team review 向けに apple-to-apple ドキュメント一式（README/CHANGELOG/CONTRIBUTING/
LICENSE/PARITY.md/package.json）を作成し、Claude Code 自身が接続済み MCP tools と CLI を並走実行して
side-by-side 比較する。

### State
- [x] Phase 1: behavioral-spec.md (50 REQ) + verification-architecture.md (25 PROP) 作成、
  spec-review PASS（adversary + codex 計6+4 iteration、収束）
- [x] Phase 2a: `scripts/docs-check.mjs`（Tier-1 機械検証、16 assertion）作成、RED 確認
  （16/16 FAIL、regression `npm test` 408/408 green）
- [>] Phase 2b: README.md / CHANGELOG.md / CONTRIBUTING.md / LICENSE / PARITY.md / package.json /
  execution-notes.md（本セクション）実装、GREEN 化中
- [ ] Phase 3-4: `defi`/`markets`/`rpc`/`phone` dual-live-run 実測（MCP wallet funding 待ち）、
  image/video/music の fresh re-run（full URL evidence, DOC-EVID-001..005）
- [ ] Phase 5-6: adversary review PASS + harden/converge

### Decisions
- codex-review はもう今後のゲートではない（Dais指示、2026-07-08）。唯一の必須レビューゲートは
  fresh-context Claude adversary。過去の codex citation は事実記録として保持。
- Claude Code 前提の apple-to-apple 検証: 18コマンドを DUAL-LIVE-RUN 9件（wallet/chat/models/dex/
  price/defi/markets/rpc/phone）と SCHEMA-ONLY 9件（image/video/music/realface/modal/speech/search/
  exa/surf）に分割。前者は実際に MCP tool + CLI を並走実行して比較、後者はパラメータschema静的照合 +
  VERIFICATION.md の既存実行証拠を再利用（二重課金回避）。
- MCP接続ウォレット（Base 0x99b3fE1Ef8Fd94AfA5FF3448B3d7f05372cFa94e / Solana
  8FpqdcCHqjqkVXR58eVJa53neXbJf9emXhvHhgeUPCV9）は2026-07-08時点で残高$0。defi/markets/rpc/phone の
  dual-run はfunding後にPhase 3/4で実施。

### Evidence log（Phase 2b時点）
- MCP実測（2026-07-08、無料コマンドのみ）: wallet=構造差異あり（active-chain平坦化+wallets nest）、
  models=構造差異+件数差異（category=chat: MCP 44 vs CLI 55）、dex=byte-identical、price=field-set
  一致（値のみ変動）、chat(mode=free)=field-set一致（model_used値のみ変動）。詳細はPARITY.md参照。
