# blockrun-cli — execution notes

Goal: blockrun-mcp v0.28.0 の全18ツールを 1:1 で CLI 化、実API E2E 検証つき。
Source of truth: /goal (session)。VCSDD state = .vcsdd/。

## State
- [x] repo 作成 + push (github.com/Daisuke134/blockrun-cli)
- [ ] VCSDD init(strict) → spec → spec-review → tdd → impl → adversary → harden → converge
- [~] E2E 資金: Aave v3 Base withdraw 実行 (tx 0xb18b779759beda51a4d8397cfc098a0f12985339d1176e8a5383893396cd3489, status 0x1) → 0x810f Base USDC = $0.595。E2E最小 ≈$0.30 (video 1s $0.05 + music $0.1575 + search max_results=1 $0.025 + image $0.015 + 他 ≈$0.05) の2倍。不足時のみ POL 7.1 (Polygon) を bridge（予備）。Polymarket $19.26 は未証明経路のため不使用
- [ ] E2E 18/18 + VERIFICATION.md

## Decisions
- 言語 TypeScript（org 全体 TS 主力、CONTRIBUTING.md が TS 前提）
- @blockrun/llm SDK を wrap、x402/wallet 再実装しない
- CLI-Anything は方法論のみ採用（--json、4層テスト）。Python 生成物不採用
- npm publish しない（repo 公開まで）
- 参照 clone: blockrun-mcp = scratchpad/blockrun-mcp (v0.28.0)

## Evidence log
- ~/.blockrun/.session EVM addr = 0xAaD274758048A133C78b7Ac518aD2e46912e262c (Base USDC 0)
- 0x810f6d61f7606deee2657d3083e150a222bc29c5 Base USDC = $0.2797, ETH 1.37e13 wei
- MCP npx cache 破損確認 (@solana/web3.js 欠落) — CLI の存在意義の実例
