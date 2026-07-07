# blockrun-cli — Verification Architecture

Feature: `blockrun-cli` · Mode: strict · Companion to `behavioral-spec.md` (same directory).

---

## 1. Purity boundary

The system splits into a **pure core** (deterministic, no I/O, unit-testable with `node:test` and zero mocks) and an **impure shell** (network, filesystem, process, wallet key material). Every pure-core function is a direct 1:1 port of an existing `blockrun-mcp` function — same file origin noted per function — so its expected behavior is provable against the clone's own unit tests (e.g. `test/surf.test.ts`), not invented.

### 1.1 Pure core (`src/core/*.ts`)

| Module | Functions | Ported from (clone) |
|---|---|---|
| `cost/surf.ts` | `estimateSurfCost(path)` | `src/tools/surf.ts:69-77` |
| `cost/defi.ts` | `estimateDefiCost(path)` | `src/tools/defi.ts:21-23` |
| `cost/exa.ts` | `estimateExaCost(path, body)` | `src/tools/exa.ts:21-28` |
| `cost/markets.ts` | `estimateMarketCost(path, body)` | `src/tools/markets.ts:11-24` |
| `cost/modal.ts` | `estimateModalCost(path)`, `modalTimeoutMs(body)` | `src/tools/modal.ts:21-23,34-39` |
| `cost/phone.ts` | `estimatePhoneCost(path, hasBody)` | `src/tools/phone.ts:25-35` |
| `cost/search.ts` | `estimateSearchCost(body)` | `src/tools/search.ts:28-33` |
| `cost/chat.ts` | `estimateChatCost(maxTokens, mode, model, routing, routingProfile, thinkingBudget)` | `src/tools/chat.ts:22-79` |
| `cost/image.ts` | `estimateCost(model, size)`, `isLargerThanBase(size)` | `src/tools/image.ts:143-155` |
| `cost/speech.ts` | `speechCost(model, charCount)` | `src/tools/speech.ts:54-58` |
| `path-safety.ts` | `hasPathTraversal(path)`, `normalizeClassifyPath(path)`, `isValidNetworkSlug(slug)` | `src/utils/path-safety.ts` (verbatim) |
| `errors.ts` | `formatError(message, opts)`, `extractErrorMessage(err)`, `isPaymentRejectionError(message)` | `src/utils/errors.ts` (verbatim, minus the `getChain()` import — CLI passes chain in explicitly since it has no shared module-level chain cache requirement) |
| `budget.ts` | `checkBudget`, `reserveBudget`, `reReserveIfHigher`, `recordSpending`, `recordActualSpend`, `amountToUsd`, `parseBudgetLimitEnv` | `src/utils/budget.ts` (verbatim) |
| `body.ts` | `coerceBody(body)`, `asStructuredContent(result)` | `src/utils/body.ts` (verbatim) |
| `args/<command>.ts` (×18) | pure `buildRequest(flags) → { endpoint?, params?, body? }` mapping per command, validated with the ported zod schema before returning; for `search`/`exa` specifically, also resolves ergonomic aliases into the canonical `body` field (REQ-023) and rejects an alias+`--body` conflict for the same field | new code; schema literal-for-literal from each `src/tools/*.ts` `inputSchema` (search.ts, exa.ts for the alias tables) |
| `render.ts` | `renderJson(result) → string`, `renderHuman(result, commandName) → string`, `renderError(err, opts) → { json: object, human: string }` | new code; JSON branch trivial (`JSON.stringify`), human branch mirrors each tool's `content[0].text` template literal |
| `cli-budget-schema.ts` | `encodeBudgetLedger(state) → string`, `decodeBudgetLedger(raw) → state`, `checkPersistedBudget(state, agentId, estimate)` (reuses `budget.ts`'s ported `checkBudget` logic against the file-backed shape) | new code; schema per REQ-019a, logic ported from `src/utils/budget.ts`'s `checkBudget` |

**Purity contract for this layer**: no `fetch`, no `fs`, no `process.env` read beyond a value already passed as a plain argument, no `Date.now()`/`Math.random()` except where the ported function itself uses it deterministically-enough for a snapshot test (none of the ported functions do). Every function here is synchronous or a pure `async` wrapper with no awaited I/O.

### 1.2 Impure shell (`src/shell/*.ts`, `src/commands/*.ts`)

| Module | Responsibility | Impurity |
|---|---|---|
| `shell/wallet.ts` | `getChain()`, `setChain()`, `getClient()`, `getImageClient()`, `getPriceClient()`, `getAnthropicClient()`, `ensureBothWallets()`, `getChainBalance()` | reads `~/.blockrun/.chain`, `~/.blockrun/.session`, `~/.blockrun/.solana-session`; calls `@blockrun/llm` constructors; network for balance RPC — thin re-export/wrapper of `@blockrun/llm`'s own functions (`getOrCreateWallet`, `getOrCreateSolanaWallet`, `loadSolanaWallet`), NOT reimplementations |
| `shell/manual-x402.ts` | the shared submit→402→sign→poll flow for `video`/`music`/`speech`/`realface` | network (`fetch`), calls SDK's `createPaymentPayload`/`parsePaymentRequired`/`extractPaymentDetails` |
| `shell/qr.ts` | QR generation + system-viewer open (for `wallet setup/qr`, `realface init`) | filesystem write, spawns OS viewer |
| `shell/budget-store.ts` | reads/atomically writes `~/.blockrun/cli-budget.json` (REQ-019b), calling the pure `cli-budget-schema.ts` encode/decode/check functions around the actual fs calls | filesystem read + atomic write (`.tmp-<pid>` then `rename()`) |
| `commands/*.ts` (×18) | CLI-flag parsing (delegates to `args/<command>.ts` for the pure mapping) → calls the appropriate SDK method or `shell/manual-x402.ts` flow → passes the result to `render.ts` → writes stdout/stderr → sets process exit code | network, process I/O |
| `cli.ts` (entrypoint) | registers all 18 commands, `--help`, top-level dispatch | process argv, process.exit |

**Impurity is fenced at the command layer**: a `commands/*.ts` file is the ONLY place allowed to import an `@blockrun/llm` client class or call `fetch`. This mirrors `blockrun-mcp`'s own convention (`getClient()` is the single chokepoint every tool imports from `utils/wallet.ts`, never constructing `LLMClient` inline) — see CONTRIBUTING.md "Adding a new MCP tool" step 2.

---

## 2. Proof obligations (PROP-XXX)

Each PROP cites the REQ(s) it discharges and its verification tier. Tiers:

- **Tier 0 — Static.** `tsc --noEmit` (whole repo); a schema-parity check comparing each `args/<command>.ts` zod schema's field names/enums/defaults against a JSON fixture transcribed from the clone's `inputSchema` (a data table, not a live import of the clone — the clone is a separate repo not a dependency).
- **Tier 1 — Pure unit test** (`node:test`, no mocks, no network, no fs, no subprocess). Covers §1.1 pure-core modules.
- **Tier 2 — Mocked-SDK integration test + built-CLI subprocess test.** (a) Integration: import a `commands/*.ts` module directly, monkey-patch/mock the `@blockrun/llm` client via `tsx --experimental-test-module-mocks` (the exact mechanism `blockrun-mcp`'s own `package.json` `test` script already uses), assert the mock was called with the correctly-mapped request AND that the command's stdout/exit-code contract (REQ-006 through REQ-011) holds against a canned mock response/error. (b) Subprocess: `node dist/cli.js <command> <flags> --json` spawned as a real child process against a **local stub HTTP server** (for the manual-402 flows: video/music/speech/realface) or the mocked module (for SDK-mediated flows), asserting real process exit code and real stdout/stderr stream separation — this is the only tier that proves the built ESM bundle actually runs (tsup output, bin shebang, Node ESM resolution), which Tier 1/module-mock tests cannot prove.
- **Tier 3 — Real-backend E2E.** Real `https://blockrun.ai/api` (or `sol.blockrun.ai`), real x402 USDC settlement on Base mainnet, one funded verification wallet, evidence recorded in `VERIFICATION.md`.

### 2.1 Global CLI behavior (REQ-001–REQ-023)

| PROP | REQ | Tier | Verification |
|---|---|---|---|
| PROP-001 | REQ-001, REQ-002 | 0 | `package.json` has `bin.blockrun`; `cli.ts` registers exactly the 18 names (assert via a Tier-1 test importing the command registry array and checking `.length === 18` and the name set matches the fixture). |
| PROP-002 | REQ-003, REQ-005 | 0+1 | Schema-parity fixture (Tier 0) + Tier 1 test that each `args/<command>.ts` schema `.safeParse()`s the documented example payloads from each tool's description block in the clone and REJECTS obviously-wrong types (e.g. `max_tokens: "abc"`). |
| PROP-003 | REQ-004 | 1+2 | Tier 1: the pure JSON-coercion logic given an ALREADY-READ string content (injected as a plain argument, no `fs` call) — `--param-json '[...]'` and an in-memory string standing in for file content coerce IDENTICALLY; zero filesystem access in this test. Tier 2: `--param @file.json` against a REAL temp fixture file — proves the impure `fs.readFileSync` read wires correctly into the Tier-1-proven pure coercion (moved here per spec-review advisory: file I/O is impure-shell, not pure-core). |
| PROP-004 | REQ-006, REQ-007 | 2 | Subprocess test: run with `--json`, assert `JSON.parse(stdout)` succeeds and stderr is either empty or contains only log lines (regex: no line looks like JSON); run without `--json`, assert stdout is non-JSON human text. |
| PROP-005 | REQ-008, REQ-009 | 2 | Subprocess test: success path exit code `0`; forced-failure path (mocked network error) exit code `!== 0`. |
| PROP-006 | REQ-010, REQ-011 | 1+2 | Tier 1: `renderError()` unit test on canned error shapes → correct JSON/text shape. Tier 2: subprocess with a mocked 4xx confirms the JSON error object appears on stdout (not stderr) when `--json`, and human text appears on stderr when not. |
| PROP-007 | REQ-012, REQ-013, REQ-014 | 2 | Subprocess test: `--help` output line count ≤ ~40 (30 body + flag table overhead) per command; snapshot-style assertion that every zod field name appears in the help text. |
| PROP-008 | REQ-015, REQ-016 | 1+3 | Tier 1: `getChain()`-equivalent precedence logic ported verbatim and unit-tested against the 4 precedence branches using injectable fs-read stubs (dependency-injected, not real fs — this one function IS given a thin seam so precedence LOGIC is Tier-1-testable without touching real files; the actual fs read call itself is exercised for real in Tier 3). Tier 3: real wallet files on the isolated test HOME prove the real read path works. |
| PROP-009 | REQ-017 | 3 | E2E harness proof: spawn the built CLI twice with two different `HOME` env values, assert two DIFFERENT wallet addresses are created/read (`wallet status --json` → compare `address` field) — proves hermetic isolation without any SDK modification. See §4. |
| PROP-010 | REQ-018 | 1 | Tier 1: per-invocation cap precedence unit tests — `--budget-limit` flag > `BLOCKRUN_BUDGET_LIMIT` env (`parseBudgetLimitEnv`, same cases as the clone's own: `"5"`, `"5.00"`, `"$5"`, `"abc"→null`, `"-1"→null`) > unlimited; assert (via a mocked fs layer) that resolving this cap makes ZERO reads/writes of `~/.blockrun/cli-budget.json` — proving it is a purely ephemeral, non-persisted rail per REQ-018. |
| PROP-011 | REQ-019, REQ-019a, REQ-019b | 1+2+3 | Tier 1: `cli-budget.json`'s `{version,global,agents,updatedAt}` schema (de)serialization — pure encode/decode functions, `Map`↔plain-object round-trip for `agents`, zero fs. Tier 2: atomic-write mechanics against a REAL temp directory — assert the write goes to a `.tmp-<pid>` sibling then `rename()`s over the target; a simulated kill mid-write (abort before the rename) leaves the ORIGINAL file byte-for-byte intact. Tier 3: two SEPARATE real CLI invocations against the isolated E2E `HOME` prove disk persistence end-to-end (reuses the `wallet` `delegate`→`report` roundtrip design in PROP-103). |
| PROP-011a | REQ-019c, REQ-020 | 1+3 | Tier 1: a paid command's settlement path, given a FIXTURE persisted ledger (mocked fs read), correctly rejects locally (no network call) when `fixture.global.spent + estimate > fixture.global.limit` (or the matching `agents[agent_id]` entry), and correctly computes the updated ledger to write back on success — reusing the ported `checkBudget`/`recordActualSpend` (`budget.ts`) logic verbatim against the FILE-backed state instead of the MCP server's in-memory `BudgetState`. Tier 3: `wallet budget set` with a low limit in one invocation, then a paid command in a SEPARATE subsequent invocation is rejected locally when its estimate would exceed that persisted limit — proving REQ-019c's cross-invocation enforcement for real, not just in a mock. |
| PROP-012 | REQ-020, REQ-021 | 1+3 | Tier 1: each `estimate*Cost` ported function reproduces the exact clone unit-test assertions (see §2.11 below — literally the same input/output pairs as `test/surf.test.ts` etc.). Tier 3: real settled cost from a 402 quote is captured and shown to differ from (or match) the pre-call estimate in `VERIFICATION.md`. |

### 2.2 Per-command PROPs

Each command gets one Tier-1 PROP for its `args/<command>.ts` mapping + cost estimator (if any), one Tier-2 PROP for wiring (mocked SDK call + subprocess contract), and one Tier-3 PROP for the real-backend path (budgeted per §4).

| Command | Tier 1 PROP | Tier 2 PROP | Tier 3 PROP | REQs |
|---|---|---|---|---|
| `wallet` | PROP-101 — action/flag mapping incl. delegate/revoke validation | PROP-102 — mocked `ensureBothWallets`+`getChainBalance`, subprocess `--json` shape | PROP-103 — real `status` (own invocation, free); real `chain` (own invocation, view-only, free); real `delegate` in invocation A, THEN real `report` in a SEPARATE, subsequent CLI invocation B — asserting B's output reflects the allocation A wrote to `~/.blockrun/cli-budget.json` (proves REQ-019/REQ-107a disk persistence, not just in-memory correctness; TWO processes, not one, per spec-review fix) | REQ-101–107, REQ-107a |
| `chat` | PROP-104 — `estimateChatCost` exact port test (reuse clone's own cases, extend for CLI flag defaults); Anthropic-model / smart-routing rejection-combination unit tests | PROP-105 — mocked `LLMClient.chat`/`chatCompletion`/`smartChat`, assert correct method chosen per mode/model/messages combination | PROP-106 — real call with `--mode free` (nvidia model, $0) | REQ-108–119 |
| `models` | PROP-107 — category/provider filter pure logic | PROP-108 — mocked `listModels`/`listAllModels` | PROP-109 — real call (free) | REQ-120–122 |
| `image` | PROP-110 — `estimateCost`/`isLargerThanBase` exact port; edit-mode validation (model set, image count cap, mask rules) | PROP-111 — mocked `ImageClient.generate`/`.edit`, local-file/URL/data-URI normalization test with a local fixture image (no network) | PROP-112 — real `generate` with `zai/cogview-4` ($0.015, cheapest) | REQ-123–129 |
| `video` | PROP-113 — per-second cost table + image-input tier switch + mutual-exclusion validation (real_face_asset_id/image_url/last_frame_url) + `--max-quote-usd` argument validation (must be a positive number if given) | PROP-114 — subprocess against a **local stub server** replaying a real captured 402→submit→202→poll→completed sequence (fixture JSON); TWO cases: (a) stub quote ≤ `--max-quote-usd` → assert `createPaymentPayload` IS called and the job completes; (b) stub quote > `--max-quote-usd` → assert `createPaymentPayload` is NEVER called (mocked/spied), the process exits nonzero, and the exact quote appears in both the human message and the `--json` error object — this is the mechanical proof of REQ-135a's non-interactive gate | PROP-115 — **quote-gated real call using the product's own `--max-quote-usd` flag** (decided rule, resolves the earlier §4.3 contradiction): run `blockrun video --prompt "a red cube spinning" --model xai/grok-imagine-video --duration-seconds 1 --resolution 360p --max-quote-usd 0.10`. The CLI itself (REQ-135a), not the test harness, enforces the gate: if the 402 quote is `≤ $0.10` it signs and completes; if `> $0.10` it aborts before signing, exits nonzero, and the harness records the emitted quote verbatim in `VERIFICATION.md`. ONLY if that primary attempt records an abort does the harness fall back to a SEPARATE invocation at the documented-default duration (8s, `--max-quote-usd 0.50`, ~$0.40 expected) after confirming `remaining budget ≥ recorded_quote + $0.20` headroom. No step ever signs a payment without the CLI having first inspected its exact quoted amount against an explicit cap. | REQ-130–136, REQ-135a |
| `realface` | PROP-116 — action/flag validation (name/group_id/image_url required-ness per action) | PROP-117 — stub-server test of `init`→`status`→`enroll` and `portrait` flows | PROP-118 — real `init`+`status`+`list` (free); `portrait` (real, $0.01, no liveness needed); `enroll` **flagged manual** — see §4.4 | REQ-137–143 |
| `music` | PROP-119 — instrumental/lyrics mutual exclusion | PROP-120 — stub-server inline (200) AND async (202+poll) paths both tested | PROP-121 — real call ($0.1575) | REQ-144–147 |
| `speech` | PROP-122 — `speechCost` exact port; per-model char cap validation | PROP-123 — stub-server `speak`/`sound_effect`/`voices` paths | PROP-124 — real `speak` with a 2-char input (cost floor $0.001) | REQ-148–151 |
| `search` | PROP-125 — `estimateSearchCost` exact port | PROP-126 — mocked `requestWithPaymentRaw` call shape | PROP-127 — real call with `--max-results 1` ($0.025, cheapest) | REQ-152–153 |
| `exa` | PROP-128 — `estimateExaCost` exact port (contents×N, others flat) | PROP-129 — mocked call per path | PROP-130 — real `contents` with 1 URL ($0.002, cheapest) | REQ-154–155 |
| `markets` | PROP-131 — `estimateMarketCost` exact port | PROP-132 — mocked `pm`/`pmQuery` dispatch by body-presence | PROP-133 — real `polymarket/events` GET ($0.001) | REQ-156–158 |
| `price` | PROP-134 — category/action required-field validation | PROP-135 — mocked `PriceClient.price/history/listSymbols`, free-vs-paid client selection | PROP-136 — real `crypto` `price` (free) | REQ-159–162 |
| `dex` | PROP-137 — chain-filter + top-10-by-volume sort pure logic | PROP-138 — mocked `fetch` to DexScreener | PROP-139 — real call (free, real DexScreener API) | REQ-163–165 |
| `rpc` | PROP-140 — network-slug validation + batch-count cost calc | PROP-141 — mocked `requestWithPaymentRaw` | PROP-142 — real `base` `eth_blockNumber` ($0.002) | REQ-166–169 |
| `defi` | PROP-143 — `estimateDefiCost` exact port | PROP-144 — mocked `getWithPaymentRaw` | PROP-145 — real `prices/coingecko:bitcoin` ($0.001) | REQ-170–171 |
| `modal` | PROP-146 — `estimateModalCost` + `modalTimeoutMs` exact port | PROP-147 — mocked dispatch, timeout-sizing assertion | PROP-148 — real `sandbox/create`→`status`→`terminate` (~$0.012 total) | REQ-172–174 |
| `phone` | PROP-149 — `estimatePhoneCost` exact port (every branch incl. free `voice/call/{id}` GET and `numbers/release`) | PROP-150 — mocked dispatch per path | PROP-151 — real `numbers/list` ($0.001); `lookup`/`lookup/fraud`/`numbers/buy`/`voice/call` **flagged cost-prohibitive** — see §4.4 | REQ-175–177 |
| `surf` | PROP-152 — tier-table exact port INCLUDING the not-downgraded-by-query-string/trailing-slash cases (literally reuse `test/surf.test.ts`'s 2 test bodies) | PROP-153 — mocked GET/POST dispatch by body-presence | PROP-154 — real `market/price` GET ($0.001) | REQ-178–181 |

### 2.3 Cross-cutting PROPs

| PROP | REQ | Tier | Verification |
|---|---|---|---|
| PROP-200 | REQ-200 | 1 | `hasPathTraversal()` unit tests: reuse literal traversal shapes from clone's design comment (`..`, `.`, `%2e%2e`, `..\\..\\`) across all 8 path-based commands' arg builders. |
| PROP-201 | REQ-201 | 1 | `isValidNetworkSlug()` unit tests (valid: `ethereum`, `arbitrum-one`; invalid: `../x`, `a.b`, `a/b`). |
| PROP-202 | REQ-210, REQ-211 | 1 | `formatError`/`extractErrorMessage` unit tests reusing the clone's own classification edge cases (the `$402.50` / `max 5000 characters` false-positive guards documented in `errors.ts:60-64`). |
| PROP-203 | REQ-220 | 1+3 | Tier 1: `reReserveIfHigher` unit tests (real port). Tier 3: video/speech/music E2E capture a case where the 402 quote is read and compared to the estimate in the ledger. |
| PROP-204 | REQ-221, REQ-222 | 0+1 | Tier 0: grep-based static check (part of the security/purity audit, Phase 5) that NO file under `src/` imports `viem/accounts` `signTypedData`/EIP-712 primitives directly outside `shell/manual-x402.ts`, and that `shell/manual-x402.ts` itself only calls `createPaymentPayload`/`parsePaymentRequired`/`extractPaymentDetails` from `@blockrun/llm` rather than constructing a payment payload by hand. Tier 1: a test asserting the structural cast pattern compiles against the SDK's actual `.d.ts` (i.e. the cast target type's method signatures match what `getWithPaymentRaw`/`requestWithPaymentRaw` are called with) — this is inherently a compile-time proof (`tsc --noEmit` on a fixture file), recorded here as it discharges REQ-222 specifically. |
| PROP-205 | REQ-022, REQ-023 | 1+2 | Tier 1: for every one of the 15 commands whose source schema declares `agent_id` (all 18 minus `wallet`, `models`, `dex`; `wallet`'s own `agent_id`/`agent_limit` scoping is covered by PROP-101/103), a table-driven test asserts the `args/<command>.ts` mapping threads `--agent-id <string>` verbatim into the request object when passed, and OMITS the field entirely (not `agent_id: undefined`) when not passed — this is the mechanical proof closing the spec-review finding that 12 of the 18 commands' §2 flag lists had originally omitted `agent_id`. Tier 2: mocked-SDK call assertion that `agent_id` reaches the SDK call args / budget-check call for one representative command per family (path-based passthrough: `surf`; typed: `chat`, `price`; manual-x402: `video`). |
| PROP-206 | REQ-023 (specifically REQ-152a `search`, REQ-154a `exa`) | 1+2 | Tier 1: `search`/`exa`'s alias→canonical compilation produces an IDENTICAL request body for the canonical `--body` form and every documented alias form (table-driven, one row per alias); a conflicting alias + `--body` setting the same field is rejected locally with no network call. Tier 2: mocked-SDK call-shape assertion confirms both the canonical and alias invocation forms reach the SDK with the same body object. |

---

## 3. Test taxonomy → directory layout

Mirrors `blockrun-mcp`'s own convention (`test/*.test.ts`, `node:test` via `tsx --experimental-test-module-mocks --test test/*.test.ts` — see `package.json` `test` script and `CONTRIBUTING.md` "Run `npm test`").

```
test/
  unit/                     # Tier 1 — pure core, zero mocks
    cost-surf.test.ts
    cost-defi.test.ts
    cost-exa.test.ts
    cost-markets.test.ts
    cost-modal.test.ts
    cost-phone.test.ts
    cost-search.test.ts
    cost-chat.test.ts
    cost-image.test.ts
    cost-speech.test.ts
    path-safety.test.ts
    errors.test.ts
    budget.test.ts
    body.test.ts
    cli-budget-schema.test.ts # REQ-019a encode/decode round-trip (PROP-011 Tier 1)
    args-<command>.test.ts   # ×18, one per command's flag→request mapping
    args-search-alias.test.ts  # REQ-152a alias↔canonical equivalence (PROP-206)
    args-exa-alias.test.ts     # REQ-154a alias↔canonical equivalence (PROP-206)
    agent-id-threading.test.ts # REQ-022 cross-cutting, table-driven over 15 commands (PROP-205)
  integration/               # Tier 2a — mocked SDK, in-process
    <command>.test.ts        # ×18
    budget-store.test.ts       # atomic write mechanics (PROP-011 Tier 2)
    budget-persisted-cap.test.ts # REQ-019c enforcement against a fixture ledger (PROP-011a Tier 1/2)
  cli/                       # Tier 2b — built-binary subprocess tests
    help.test.ts
    json-contract.test.ts    # REQ-006/007/010/011 across all 18 commands table-driven
    <command>-subprocess.test.ts  # ×18 (or table-driven single file)
    video-max-quote-usd.test.ts   # REQ-135a non-interactive gate, both branches (PROP-114)
  e2e/                       # Tier 3 — real backend, gated behind an env flag
    run-e2e.ts                # orchestrator script, NOT run by `npm test` (separate `npm run test:e2e`)
```

- Tier 0 is enforced by `npm run typecheck` (`tsc --noEmit`) and the schema-parity fixture check (a Tier-1 test file `test/unit/schema-parity.test.ts` reading a checked-in JSON fixture transcribed from the clone).
- `npm test` runs Tier 1 + Tier 2 (unit + integration + cli), matching CONTRIBUTING.md's PR checklist items ("typecheck passes", "build passes", "test passes").
- `npm run test:e2e` runs Tier 3 ONLY when `BLOCKRUN_E2E=1` and a funded wallet is present at the isolated E2E `HOME`; it is never part of the default `npm test` because it spends real USDC.

---

## 4. Tier-3 E2E design

### 4.1 Hermetic wallet isolation

Per REQ-017 / PROP-009: spawn the built CLI (`node dist/cli.js`) with `HOME=<tmp-e2e-home>` set in the child process's env. Since `@blockrun/llm` v2.13.0's compiled `dist/index.js` calls `os.homedir()` (confirmed at lines 348, 4643, 4793, 5494-5496 of the installed copy at `/opt/homebrew/lib/node_modules/@blockrun/franklin/node_modules/@blockrun/llm/dist/index.js`) with NO env-var override of its own, and Node's `os.homedir()` resolves via `process.env.HOME` on POSIX, this achieves full wallet-file isolation (`~/.blockrun/.session`, `.chain`, `.solana-session`) without touching the SDK. This is the "smallest wrapper that still avoids reimplementing signing" approach mandated by the task brief's requirement #4 — the CLI adds ZERO wallet-path logic of its own; it only documents (in its own README/E2E harness) that callers wanting isolation should set `HOME`.

The E2E harness (`test/e2e/run-e2e.ts`) SHALL:
1. Create `$TMPDIR/blockrun-cli-e2e-<timestamp>/` as the isolated `HOME`.
2. Spawn `wallet status --json` with that `HOME` once to trigger wallet auto-creation; capture the printed Base address.
3. STOP and print funding instructions (the isolated wallet's address + QR-equivalent text) if the balance is $0 — this harness cannot fund itself; a human (Dais, per this project's no-human-loop exceptions for irreversible external fund transfers) or an existing funded key placed at that HOME path must supply USDC before Tier 3 proceeds.
4. Run each command's minimal real-cost path (§4.3), appending a row to `VERIFICATION.md` after each.

### 4.2 Budget cap

Total Tier-3 budget cap: **$10.00 USDC** (hard stop — the harness aborts the remaining E2E run, not the whole task, if cumulative real spend would exceed this). Realistic expected total based on the minimum-cost path chosen per command (§4.3 table) is **≈ $0.30–$2.00**, well inside the $10 cap and inside the $3–5 Base USDC funding target already recorded in `execution-notes.md`. The two commands whose full feature surface costs more than the funding target (`phone` provisioning + `video` at non-minimal settings) are handled via the minimum-cost/flagged-manual policy in §4.3–4.4, not by raising the cap.

### 4.3 Per-command minimum-cost real path

| Command | Real path exercised | Expected cost | Note |
|---|---|---|---|
| `wallet` | `status` (invocation 1); `chain` view-only (invocation 2); `delegate` (invocation 3) → `report` (invocation 4, a SEPARATE process) verifying the delegation persisted to `~/.blockrun/cli-budget.json` | $0 | free; delegate→report MUST be two separate CLI invocations, not one in-process call, per REQ-019/PROP-103 |
| `models` | default list | $0 | free |
| `dex` | `--query SOL` | $0 | free, real DexScreener |
| `price` | `--action price --category crypto --symbol BTC-USD` | $0 | free |
| `chat` | `--mode free --message "2+2?"` | $0 | nvidia free tier |
| `defi` | `--path prices/coingecko:bitcoin` | $0.001 | cheapest defi path |
| `surf` | `--path market/price --params '{"symbol":"BTC"}'` | $0.001 | Tier 1 |
| `markets` | `--path polymarket/events` | $0.001 | Tier 1 GET |
| `rpc` | `--network base --method eth_blockNumber` | $0.002 | cheapest RPC |
| `exa` | `--path contents --body '{"urls":["https://blockrun.ai"]}'` | $0.002 | 1 URL |
| `search` | `--query test --max-results 1` | $0.025 | cheapest search |
| `modal` | `sandbox/create` → `sandbox/status` → `sandbox/terminate` | ~$0.012 | full lifecycle, cheapest tier |
| `phone` | `--path phone/numbers/list --body '{}'` | $0.001 | cheapest phone path; see §4.4 for what's NOT tested |
| `image` | `--model zai/cogview-4 --prompt "a red cube"` | $0.015 | cheapest image model |
| `speech` | `--action speak --input "hi"` | $0.001 (floor) | cost-floor input |
| `music` | `blockrun music --prompt "chill lo-fi beats"` (default model) | $0.1575 | flat price, no cheaper option exists |
| `video` | **CLI-enforced quote gate via `--max-quote-usd` (decided rule — see PROP-115/REQ-135a):** `blockrun video --prompt "a red cube spinning" --model xai/grok-imagine-video --duration-seconds 1 --resolution 360p --max-quote-usd 0.10`. The CLI itself (not the harness) inspects the 402 quote before signing and refuses to sign if it exceeds the flag's value — this answers the earlier "untested against upstream" concern: the quote itself, checked by product code, gates the spend, not a harness guess. If the CLI aborts (quote > $0.10, upstream enforces a higher floor for 1s than the per-second table implies), the harness records the emitted quote verbatim in `VERIFICATION.md`; only then does it run a SEPARATE fallback invocation at the documented-default duration (`--duration-seconds` omitted → 8s default, `--max-quote-usd 0.50`) after an explicit check that `remaining budget ≥ recorded_quote + $0.20` headroom. No step ever signs a payment without the CLI having first inspected its exact quoted amount against an explicit cap. | ≤$0.10 (primary path) or ~$0.40 (documented-default fallback, only if the primary attempt aborts AND headroom check passes) | CLI-enforced quote gate — never a blind real-money action |
| `realface` | `init` → `status` (both free) → `list` (free) → `portrait` with an AI-generated test character image | $0.01 | see §4.4 for `enroll` |

Running total: **≈ $0.17–$0.60** across all 18 commands' minimum real path (video's quote-gated primary path is ≤$0.10; the documented-default fallback, only triggered if the 1s quote exceeds $0.10 AND the headroom check passes, adds up to ~$0.40 more in the worst case) — comfortably inside both the $10 cap and the $3–5 funding target either way.

### 4.4 Explicitly untested-for-cost-or-human-reasons paths (documented, not hidden)

Per the project's honesty rule (no claiming "done" for something not run), the following sub-paths are NOT part of the automated Tier-3 run, with the reason recorded verbatim in `VERIFICATION.md` rather than silently skipped:

- `realface enroll`: requires a REAL person to complete a phone liveness check (nod + blink) via a scanned QR link within ~120 seconds — this is inherently a human-in-the-loop step that cannot be scripted. Ledger row: `status: untested — requires live human liveness step, not automatable`.
- `phone lookup` / `phone lookup/fraud`: require a real phone number to query; no fixture number is established in this spec. Ledger row: `status: untested — no fixture phone number provisioned; would cost $0.01/$0.05 against an arbitrary real number if run`.
- `phone numbers/buy` / `numbers/renew` / `voice/call`: cost $5.00 / $5.00 / $0.54 respectively; provisioning a number plus placing one call ($5.54) alone would consume more than the project's stated $3–5 E2E funding target. Ledger row: `status: untested — cost-prohibitive relative to funded wallet balance; command wiring IS covered by Tier 1/2 (PROP-149/150)`.
- `video` at higher resolutions (1080p/4K) or the documented-default 8s duration (only reached via the §4.3 fallback if the 1s quote exceeds $0.10) and `image` at 4096×4096 (nano-banana-pro large tier): the 402-quoted price for these can exceed the per-second/per-image table estimate (documented in the clone's own comments, `video.ts:180-182`, `image.ts` `LARGE_SIZE_COST`); only the cheapest quote-gated tier (360p, 1s) is exercised as the PRIMARY Tier-3 path to keep spend bounded. Ledger row: `status: untested at large-size/default-duration tier — command logic covered by Tier 1 (PROP-113), pricing behavior only provable by the cheap-tier real call actually run (or by the fallback row, if triggered)`.

### 4.5 Evidence ledger (`VERIFICATION.md`)

One row per Tier-3 call, columns: `command`, `exact CLI invocation`, `active chain` (`base`|`solana`, from REQ-016's resolution at call time), `wallet address` (the address that paid, per REQ-015), `HOME path` (the isolated E2E sandbox dir used for that invocation, per §4.1), `response id / tx hash (from X-Payment-Receipt or settlement.tx_hash)`, `output file MD5 (if a file/URL was downloaded)`, `actual cost USD (from the response, not the estimate)`, `pass/fail`, `timestamp`. Untested paths get the same row shape with `status: untested` and the reason, per §4.4 — never omitted from the table.

---

## 5. Security / purity audit hooks (feeds Phase 5 hardening)

- Grep-audit: no file outside `shell/manual-x402.ts` imports `viem/accounts` or constructs an EIP-712 payload.
- Grep-audit: no file outside `shell/wallet.ts` reads `~/.blockrun/*` directly (single chokepoint, mirrors CONTRIBUTING.md's `getClient()` convention).
- Grep-audit: no command handler calls `console.log`/`process.stdout.write` for anything other than the single final rendered result (progress/log lines go through a `stderr`-only logger) — this is the mechanical check for REQ-006.
- SSRF guard parity check: `image` command's URL/local-file loader for `--image`/`--mask` reuses the SAME `isBlockedFetchHost` deny-list logic as `image.ts:37-79` (private/loopback/link-local rejection, 30s timeout, 5-redirect cap, 4MB size cap) — Tier 1 unit test with a fixture list of blocked hosts (`127.0.0.1`, `169.254.169.254`, `10.0.0.1`, etc.).

---

## 6. Decided rules and remaining open design questions

### 6.1 Decided (executor sign-off granted at spec-review iteration 1 — not open questions)

- **`realface enroll` within the "E2E 18/18" claim.** DECIDED: `enroll` requires a REAL person to complete a phone liveness check (nod + blink, scanned QR, ~120s window) — this is inherently non-automatable, the same class as the cost-prohibitive-path exclusions in §4.4 (high-value/irreversible paths substituted with a cheaper-but-real path rather than skipped or faked). The rule: `init`/`status`/`list` (all free) ARE exercised for real against the live API in Tier 3 — proving the command's wiring, auth, and response-handling end-to-end; `portrait` ($0.01, no liveness needed) IS exercised for real; `enroll` specifically ($0.01, liveness-gated) is recorded in `VERIFICATION.md` as `status: untested — requires live human liveness step, not automatable`, per §4.4. This is the FINAL resolution — "18/18" for this feature means all 18 COMMANDS have a real, on-ledger Tier-3 entry (not that every ACTION within every command was exercised); `realface`'s ledger entry satisfies this via its 3 free real actions + 1 paid real action (`portrait`), with `enroll` documented as the one sub-path that cannot be automated, consistent with the same substitution policy already applied to `phone`'s cost-prohibitive sub-paths.
- **Schema-parity fixture generation — DECLINED for v1.** An automated generator that imports the `blockrun-mcp` clone repo at build/test time to derive the Tier-0 schema-parity fixture (§2 intro) was considered and declined: the clone is a separate, un-vendored reference repo (not a project dependency, no guaranteed stable location/version pin across environments), so a live-import generator would make Tier-0 verification depend on an external filesystem path outside this repo's control. v1 keeps the hand-audited/hand-transcribed JSON fixture (transcribed once, during Phase 1a, from the exact clone paths cited throughout this document). Reason recorded per spec-review advisory: `scope: v1 keeps hand-audited fixture, revisit post-v1`. Revisit if the clone's schemas drift enough that hand-audit becomes error-prone.
- **Budget persistence across CLI invocations — DECIDED (supersedes an earlier stale draft that said the opposite).** `wallet --action budget/delegate/revoke/report`, AND every paid command's real settled spend, DO persist across separate CLI invocations via `~/.blockrun/cli-budget.json` (REQ-019/REQ-019a/REQ-019b/REQ-019c, REQ-107a; proven by PROP-011/PROP-011a and the `wallet delegate`→`report` two-separate-invocation Tier-3 roundtrip in PROP-103). This is NOT out of scope and NOT limited to in-memory/single-process state — an earlier draft of this document said the reverse; that text is superseded by this entry and by the REQ-019 family, which are the sole authority on this point.

### 6.2 Remaining open design questions (not resolvable from source reading alone — flagged for the spec-review adversary)

1. **CLI argument syntax for nested JSON (REQ-004).** This spec specifies `--param-json`/`--param @file.json` as the mechanism for structured input without picking a specific CLI-parsing library (yargs/commander/citty/etc.); the concrete library choice is an implementation decision for Phase 2 (TDD/impl), not a spec-level requirement, since no functional REQ depends on which library is used as long as the flag contract above holds.
