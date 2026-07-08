# blockrun-cli — execution notes

Goal: blockrun-mcp v0.28.0 の全18ツールを 1:1 で CLI 化、実API E2E 検証つき。
Source of truth: /goal (session)。VCSDD state = .vcsdd/。

## State
- [x] repo 作成 + push (github.com/Daisuke134/blockrun-cli)
- [x] VCSDD init(strict) / spec v4 (REQ131/PROP74) / spec-review PASS (adversary Opus it-3: 0 blocking + codex r3 ok:true 収束済) / tdd RED (157 fail / 0 pass, evidence log有)
- [x] impl (Green) 407/407 + Phase 3 adversary review PASS (Opus iter-2 5/5 + codex round-2 ok:true、money-path blocking 7件 fix済)
- [x] harden (Phase 5) → E2E 18/18 → converge (Phase 6)
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
- 実機観測の異常2件（--json初回のonboarding漏れ / fresh環境でactiveChain=solana）→ **両方解決済みと再現テストで確認（2026-07-08）**: fresh $HOME で `wallet --action status --json` の stdout はクリーンな JSON 1行のみ（onboarding は stderr）、activeChain は "base"

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
- [x] Phase 2b: README.md / CHANGELOG.md / CONTRIBUTING.md / LICENSE / PARITY.md / package.json /
  execution-notes.md 実装、GREEN 化完了（16/16 PASS、regression 408/408 green）。
  PROP-016 allow-list を`.vcsdd/**`に拡張、PROP-007/008の自作scriptバグ2件修正。
- [x] Phase 3-4: dual-live-run 9/9 完了（wallet/chat/models/dex/price/defi/markets/rpc/phone、全て
  orchestrator実測）+ image/video/music の fresh re-run 完了（full URL + HTTP 200 + MD5 + settlement
  evidence、DOC-EVID-001..005充足）。PARITY.md/VERIFICATION.mdへ反映、PROP-022（3文書クロスチェック、
  Phase 2aで実装漏れだったTier-1 PROP）をdocs-check.mjsへ追加。
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

### Evidence log（Phase 3-4完了時点）
- MCP実測（2026-07-08、dual-live-run 9/9）: wallet=構造差異あり（active-chain平坦化+wallets nest、
  by design）、models=第1回測定でsnake_case+count:44 vs camelCase+count:55の差異を観測したが、後の
  再測定ではMCP側の出力形状自体がcamelCase+count:55に変化しCLIと完全一致（BlockRun側のライブ実装が
  測定間に変わった可能性、CLI側の問題ではない）、dex/rpc/phone/defi/markets=byte-identical、
  price/chat=field-set一致（値のみ変動）。詳細はPARITY.md参照。
- MCP接続walletへtop-up: 0x810f→0x99b3fE1... $0.005 USDC (tx 0xe41ec6c1...)、4件の有料dual-run
  （defi/markets/rpc/phone）を実行。
- media fresh re-run: image($0.015)/video($0.052501)/music($0.1575)、全てHTTP 200 + MD5検証済み。
  sandbox cli-budget.json: spent 0.316001→0.546002 (delta 0.230001、期待値と完全一致)、
  calls 19→28。live preflightは全てnumberを返しfallback不要だった。
  詳細: `.vcsdd/features/blockrun-cli-docs/evidence/{image,video,music,media-run-summary,topup-mcp-1}.json`

### `src/index.ts` 1行例外（2026-07-08、Dais指示）

**発見**: `blockrun --version` が `0.1.0` を返す一方、`package.json`は`1.0.0`。原因は
`src/index.ts:89`の`.version("0.1.0")`ハードコード（`package.json`のversionフィールドとは独立）。
v1.0.0タグを打つ前にこの不整合を放置すると、BlockRunチームの厳格レビューで確実に指摘される実害あり。

**根拠**: このfeatureは`src/`/`test/`/`dist/`を一切変更しない、という原則（REQ-NG-001/
DOC-CONSTRAINT-001）を開始以来ずっと守ってきた。しかし今回のケースは「docsを実体に合わせて直す」の
逆で、実体（バイナリの`--version`出力）側に明確なバグがあり、それをdocs側で取り繕うことができない
（`--version`はドキュメントではなく実行結果そのもの）。Daisの直接指示により、`.version(...)`の
literal 1行のみに限定した狭い例外として認めることにした。

**対応**:
- `src/index.ts:89`の`.version("0.1.0")`を`.version("1.0.0")`に変更（1行のみ）
- `npm run build`で`dist/`を再生成、`blockrun --version`が`1.0.0`を返すことを確認
- behavioral-spec.mdにDOC-CONSTRAINT-001a、verification-architecture.mdにPROP-016b（新規）を追加
  し、この例外の境界を明文化
- docs-check.mjsにPROP-016bを実装: `git diff <feature-start> -- src/`の変更が**行レベルで**
  ちょうど1行（`.version("...")`パターンに一致）であることを機械検証。未追跡の新規ファイルが
  `src/`配下に増えていないかも別途チェック
- 実装中に発見した副次バグ: PROP-016/PROP-016bは元々`git diff <ref> HEAD`という2-ref比較を
  使っており、これは**未コミットの変更を一切検知できない**（HEADはコミット済み状態のみを指す）。
  実際に`src/index.ts`を編集した直後に検証したところ「src/に変更なし」と誤ってPASSしたため発覚。
  `git diff <ref>`（working treeとの比較、未コミット変更を含む）+
  `git ls-files --others --exclude-standard`（未追跡の新規ファイル）に修正し、意図的に別の行を
  `src/index.ts`に追加してPROP-016bが正しくFAILすることを確認した上で元に戻した（検証ロジック自体
  の実効性を証明）。
- 結果: `node scripts/docs-check.mjs` 18/18 PASS、`npm test` 408/408 green維持、
  `dist/`はgitignore対象（差分チェック対象外）。

## 2026-07-08 — blockrun-cli-docs feature COMPLETE (VCSDD phase=complete)
- Docs suite shipped: README/CHANGELOG/CONTRIBUTING/LICENSE/PARITY.md + package.json 1.0.0 — apple-to-apple with blockrun-mcp (adversary-verified side-by-side).
- Verification chain: docs-check 18/18 · tests 408/408 · 9/9 MCP↔CLI dual-runs (4 byte-identical) · 3 media fresh re-runs (HTTP 200 + MD5 + txHash) · ledger delta exact-match $0.230001 · Phase 5 security/purity reports clean.
- Review trail: spec 6 iterations (adversary Opus ×4 + codex ×3, converged) → impl review PASS (0 blocking) → harden PASS → converge PASS.
- Tagged v1.0.0.

## Cross-feature note: blockrun-cli-agent-dx changes the real subcommand count 18→19 (2026-07-08)

`blockrun-cli-agent-dx` (a separate, later feature — see `.vcsdd/features/blockrun-cli-agent-dx/`)
adds a 19th subcommand, `blockrun commands` (REQ-DX-001), which this `blockrun-cli-docs` feature's
`scripts/docs-check.mjs` did not anticipate (it was written when 18 was the fixed universe). Updated
in `scripts/docs-check.mjs` (owned by this feature, edited by agent-dx since it is the only Tier-1
regression script that encodes the real command count) to keep both features' Tier-1 checks mutually
consistent:
- Top-level gate + PROP-002 (README `## Commands` table): now expect **19** rows/names (18 original +
  `commands` itself).
- PROP-012 (PARITY.md per-command `### <command>` MCP-parity sections): still expects exactly **18**
  sections — `commands` is explicitly EXCLUDED from this check, since REQ-DX-033 documents it as a
  CLI-only introspection command with NO `blockrun-mcp` tool equivalent (a "Known non-parity points"
  bullet instead of a per-command section). The 18 original commands' sections are unchanged.
- PROP-016/016b (this feature's own src/-untouched-since-init regression guard, `FEATURE_NAME` hardcoded
  to `"blockrun-cli-docs"`) INITIALLY appeared to permanently FAIL once re-run against the current repo
  state, since they diffed against a SINGLE ref (this feature's own init commit) through the ever-moving
  working tree/HEAD — any later src/ feature landing real changes would trip them forever. FIXED (same
  day, per team-lead instruction): both checks now diff a FROZEN, two-commit historical range —
  `eadc61c` ("vcsdd(docs): init blockrun-cli-docs feature (lean)") through `a38b32a` ("vcsdd(docs):
  converge PASS — feature complete") — a permanent, one-time-true fact about the COMPLETED
  blockrun-cli-docs feature, immune to any later feature's src/ work. `node scripts/docs-check.mjs` is
  **18/18 PASS** again. See `.vcsdd/features/blockrun-cli-agent-dx/evidence/sprint-1-green-phase.log`
  for the full before/after detail.

## Cross-feature note: blockrun-cli-agent-dx's `activeBalanceUnavailableReason` field name (IMPL-DX-1, 2026-07-08)

`blockrun-cli-agent-dx`'s impl-review (fresh Opus adversary, iteration 1) found a spec/implementation
naming mismatch: REQ-DX-023 originally said `wallet --action chain --json`'s top-level `activeBalance`
field gains the SAME `balanceUnavailableReason` name `status`'s per-chain `base`/`solana` sub-objects
use (REQ-DX-020) when null — but the shipped `src/commands/wallet.ts` implementation actually uses
`activeBalanceUnavailableReason` (an `active`-prefixed sibling of `activeBalance`), undocumented as an
intentional deviation.

**Resolution (implementation kept, spec corrected to match — NOT the reverse)**: `activeBalanceUnavailableReason`
is the correct, intentional name — it matches the `activeBalance` field it explains, and avoids any
ambiguity a bare `balanceUnavailableReason` would have at that TOP level (unlike `status`'s per-chain
sub-objects, where `base.balanceUnavailableReason`/`solana.balanceUnavailableReason` are already
chain-scoped by their parent object, `chain` action's top-level `activeBalance` has no such parent
scoping, so a bare name would be genuinely ambiguous about which chain it refers to). REQ-DX-023 in
`.vcsdd/features/blockrun-cli-agent-dx/specs/behavioral-spec.md` updated to state
`activeBalanceUnavailableReason` explicitly, with this rationale recorded inline. A regression test
covering both the null (`reason` present) and real-number-including-zero (`reason` key absent) cases
for the `chain` action was added to `test/integration/wallet.test.ts` (previously ZERO tests, at any
tier, covered this field — the gap the adversary caught).
