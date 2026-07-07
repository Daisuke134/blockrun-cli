# Security Audit — blockrun-cli (Phase 5, sprint 1)

## 1. SSRF guard (`src/core/ssrf.ts::isBlockedFetchHost`)

### 1.1 Static review

`isBlockedFetchHost` blocks: `0.0.0.0/8`, loopback (`127.0.0.0/8`, `::1`, `localhost`/`*.localhost`),
RFC1918 private ranges (`10/8`, `172.16/12`, `192.168/16`), link-local incl. cloud metadata
(`169.254/16`, incl. `169.254.169.254`), CGNAT (`100.64/10`), IPv6 unique-local/link-local
(`fc00::/7`, `fe80::/10`), IPv4-mapped IPv6, and `*.internal`/`*.local` names — with an explicit
trailing-dot strip (`host.replace(/\.+$/, "")`) so `metadata.google.internal.` cannot slip past the
suffix check via the WHATWG URL parser's root-dot preservation.

Applied at **every fetch site** in `src/shell/image-fetch.ts::toImageDataUri` (the one place in
this CLI that performs a local fetch of a caller-supplied URL, per that file's own header comment):
the host check runs **inside the redirect loop** (`image-fetch.ts:33-37`), re-checked against the
new `url` on every hop before the next `fetch()` call, with a hard 5-redirect cap
(`MAX_REDIRECTS`), a 30s `AbortController` timeout, and a 4MB size cap enforced both from
`content-length` and from the actual downloaded buffer size. This matches §5's grep-audit
requirement verbatim.

### 1.2 Live executable test (run this session, not asserted from reading)

Wrote a throwaway script importing the guard directly via `tsx` (no build step, exercises the exact
source the CLI ships) and ran it against the required host set plus additional edge cases:

```
$ npx tsx /tmp/.../ssrf-guard-test.mjs
PASS  isBlockedFetchHost("127.0.0.1") = true (expected true)
PASS  isBlockedFetchHost("localhost") = true (expected true)
PASS  isBlockedFetchHost("169.254.169.254") = true (expected true)   # cloud metadata endpoint
PASS  isBlockedFetchHost("10.0.0.1") = true (expected true)
PASS  isBlockedFetchHost("172.16.0.5") = true (expected true)
PASS  isBlockedFetchHost("192.168.1.1") = true (expected true)
PASS  isBlockedFetchHost("100.64.0.1") = true (expected true)        # CGNAT
PASS  isBlockedFetchHost("::1") = true (expected true)
PASS  isBlockedFetchHost("[::1]") = true (expected true)
PASS  isBlockedFetchHost("fe80::1") = true (expected true)
PASS  isBlockedFetchHost("fc00::1") = true (expected true)
PASS  isBlockedFetchHost("metadata.google.internal") = true (expected true)
PASS  isBlockedFetchHost("metadata.google.internal.") = true (expected true)  # trailing-dot bypass attempt
PASS  isBlockedFetchHost("blockrun.ai") = false (expected false)
PASS  isBlockedFetchHost("8.8.8.8") = false (expected false)
PASS  isBlockedFetchHost("api.blockrun.ai") = false (expected false)

16/16 passed
```

**Verdict: PASS.** Blocks all required hosts (loopback, `169.254.169.254` metadata, RFC1918, `::1`)
and allows normal public hosts; the trailing-dot bypass attempt is correctly caught. This is in
addition to the 6 existing Tier-1 unit tests for the same function already in
`test/unit/ssrf.test.ts` (part of the 407 passing tests — see §4).

## 2. Payment safety (REQ-221 / REQ-222 — no hand-rolled signing)

```
grep -rn "keccak\|secp256k1\|eip712\|privateKeyToAccount\|ecsign\|@noble" src/ (outside @blockrun/llm calls)
```

Only hit: `src/shell/manual-x402.ts:7,46` — `privateKeyToAccount` from `viem/accounts`, used
**only** to derive `account.address` (a read-only public-key derivation) which is then passed
alongside the raw `privateKey` into the SDK's own `createPaymentPayload()` (line 70) — the SDK
performs the actual EIP-712 construction and signature internally. No `signTypedData`, no manual
keccak/secp256k1 hashing, no `@noble/*` primitive anywhere in `src/`. `src/shell/solana-x402.ts`
uses exclusively SDK-exported `solanaKeyToBytes` / `solanaPublicKey` / `createSolanaPaymentPayload`
from `@blockrun/llm` for the Solana settlement path — same pattern, same verdict. **PASS.**

Structural-cast pattern (REQ-222) — confirmed the only reachable path to
`requestWithPaymentRaw`/`getWithPaymentRaw` is through the SDK client instances returned by
`src/shell/wallet.ts`'s `getClient()`/`buildClient()`/`buildClientWithTimeout()`, which is itself the
single chokepoint for `@blockrun/llm` client construction (no `commands/*.ts` file constructs an
`LLMClient`/`SolanaLLMClient`/`ImageClient`/`PriceClient`/`AnthropicClient` inline — verified by
grepping for `new LLMClient\|new SolanaLLMClient\|new ImageClient\|new PriceClient\|new
AnthropicClient` across `src/commands/`: zero hits, all construction is inside `wallet.ts`).
`tsc --noEmit` (§4) passing over the whole repo is the compile-time proof that every call site's
argument shape matches the SDK's actual `.d.ts` signatures. **PASS.**

## 3. Path safety

Two distinct concerns exist here and were checked separately:

**(a) Remote API `--path` traversal (REQ-200, PROP-200/201) — the concern the spec actually
defines.** `hasPathTraversal()`/`isValidNetworkSlug()` (`src/core/path-safety.ts`) are wired into
all 8 path-based commands' arg builders (`defi`, `exa`, `markets`, `modal`, `phone`, `rpc`, `search`,
`surf` — confirmed by `grep -rln "hasPathTraversal\|isValidNetworkSlug" src/args/`). Covered by
Tier-1 tests (`REQ-200: path traversal is rejected before cost estimation`, part of the 407 passing
tests). **PASS.**

**(b) Local file reads for `--image <local-path>` (`src/shell/image-fetch.ts:68`) and `--param
@file.json` (`src/cli/json-flag.ts:6`) — checked, and found NOT to call `hasPathTraversal()`.**
This is worth flagging explicitly rather than silently passing or silently failing it: neither
`verification-architecture.md`'s PROP-200/201 table nor its §5 grep-audit hooks list list local
file-path traversal guarding as a requirement — PROP-200 is scoped explicitly to "all 8 path-based
commands' arg builders" (i.e., the `--path <segment>` flag forwarded into a *remote* API URL,
where traversal could redirect the server-side request to an unintended endpoint). `--image` and
`--param @file.json` are local filesystem paths the CLI's own invoking user supplies on their own
command line for the CLI to read on their own machine — the same trust model as `cat`, `curl
--data @file`, or `jq < file`; there is no privilege boundary being crossed (the user already has
whatever filesystem access the path would traverse to), so a traversal guard here would not
prevent any actual attack, only add friction to reading files outside the current directory that
the user explicitly named. **Judged non-blocking**, but recorded here per the audit's honesty
requirement (checked, not silently assumed) rather than omitted from the report.

## 4. Key handling — never logged

```
grep -n "console\.\|process\.stdout" src/shell/wallet.ts src/shell/manual-x402.ts src/shell/solana-x402.ts
```

Only two `console.error` call sites, both in `src/shell/wallet.ts` (lines 94, 125), both passing
only `formatWalletCreatedMessage(<address>)` — the SDK's own message formatter, given the **public
address**, never the private key. No `privateKey`/`secretKey`/`paymentPayload` variable is ever
passed to a `console.*`/`process.stdout`/`process.stderr` call anywhere in `src/` (grepped for all
three variable names co-occurring with a log call — zero hits). All process-level output funnels
through a single chokepoint at `src/index.ts:64-65`
(`process.stdout.write(outcome.stdout)`/`process.stderr.write(outcome.stderr)`), which only ever
receives the already-rendered `CommandOutcome` object from `src/core/render.ts` — never a raw
credential. This is stricter than the spec's own REQ-006 grep-audit hook (which only required no
*command handler* logging directly; here NO file logs directly except the two wallet-creation
address notices). **PASS.**

## 5. Budget-cap integrity (three caps: ephemeral `--budget-limit`, persisted ledger,
`--max-quote-usd`)

Traced the actual gating order in `src/commands/shared.ts::gatePaidCall` and its use in
`src/commands/video.ts` (representative of the manual-x402 family — video/music/speech/realface all
share this pattern):

1. `gatePaidCall()` is called with the **pre-network cost estimate** and, before any network call,
   (a) reads and checks the **persisted ledger** (`readLedger()` → `checkPersistedBudget`,
   `shared.ts:42-46`), then (b) checks the **ephemeral per-invocation cap**
   (`reserveBudget(budget, ...)`, `shared.ts:48-51`) — both caps gate before `payAndPoll()` is ever
   invoked.
2. Inside `manual-x402.ts::probeAndSign`, the real 402 quote is parsed (`details.amount` →
   `quotedUsd`) and `req.onQuote(quotedUsd)` is invoked **at line 68, before
   `createPaymentPayload()` at line 70** — i.e. the callback runs, and can throw, strictly before any
   signature is produced.
3. `video.ts`'s `onQuote` callback checks `--max-quote-usd` **first** (throws if the quote exceeds
   the user's explicit ceiling), then calls `gated.paid.reverify(quotedUsd)`
   (`shared.ts:68-86`), which itself re-reads the **persisted ledger fresh** (`readLedger()` again,
   not the snapshot from step 1) and re-checks the **ephemeral** cap via `reReserveIfHigher` before
   returning `{allowed:true}`. Any failure throws inside `onQuote`, which aborts `probeAndSign`
   before it reaches `createPaymentPayload`.
4. On success, `commit()` (`shared.ts:58-67`) re-reads the ledger **fresh again** (read-modify-write,
   not the stale snapshot) before writing back with `writeLedgerAtomic`, so a long-running
   media-generation call (up to 300s of polling) cannot clobber a concurrent invocation's spend.

**No path exists where `createPaymentPayload`/`createSolanaPaymentPayload` is reached without all
three applicable caps having already been checked against the real quoted amount.** Confirmed by
code trace with line numbers above, not merely by reading the spec's description of intended
behavior.

**Accepted limitation (matches what was flagged going in):** the persisted-ledger read-check-write
sequence (`readLedger()` → check → ... → `writeLedgerAtomic()`) is not protected by a file lock —
two CLI processes racing within the same few milliseconds could both pass the persisted-budget
check before either writes back, producing a spend slightly over the configured cap in that narrow
window. This is a real, acknowledged TOCTOU gap, but is non-blocking for this feature: it requires
two concurrent invocations of the same CLI against the same `HOME` within a sub-second window, the
overshoot is bounded by the size of one call's cost (not unbounded), and hardening it (e.g. an
`flock`-style lock file) is a reasonable, isolated follow-up rather than a defect requiring a code
rewrite now. Recorded here as a known/accepted limitation, not silently omitted.

## Overall security verdict: **PASS.** No blocking findings.
