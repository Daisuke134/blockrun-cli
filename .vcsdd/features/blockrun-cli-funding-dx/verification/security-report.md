# Security Hardening Report — blockrun-cli-funding-dx (Phase 5)

## Tooling

| Tool | Availability | Used for |
|---|---|---|
| `semgrep` (v1.168.0) | Installed (`/opt/homebrew/bin/semgrep`) | SAST over the changed source files (`--config=auto`, 210 rules, TS + multilang) |
| Wycheproof | N/A | This feature introduces no cryptographic primitive, key derivation, signing, or verification code of its own — it reuses the pre-existing `payOnce()`/`probeAndSign()` x402 signing path in `src/shell/manual-x402.ts` unchanged. Wycheproof-style crypto test vectors are not applicable to this feature's diff. |
| Manual code audit | N/A tool, done by hand | `openUrl()` URL-validation ordering, `spawn()` argv-array injection-safety, `payOnce(`/`onQuote` call-site completeness, secrets sweep |

### Semgrep

- **Command**: `semgrep --config=auto src/commands/wallet.ts src/args/wallet.ts src/core/errors.ts src/index.ts src/shell/qr.ts src/shell/manual-x402.ts --json --output verification/security-results/semgrep-raw.json`
- **Scope**: the 4 source files actually touched by this feature's diff (`src/args/wallet.ts`, `src/commands/wallet.ts`, `src/core/errors.ts`, `src/index.ts` — per `git diff --stat eeee0e3..HEAD`), plus the 2 files most relevant to the new deposit code path's security surface (`src/shell/qr.ts` for `openUrl()`, `src/shell/manual-x402.ts` for `payOnce()`/`onQuote`), even though those 2 were not modified by this feature.
- **Raw output**: `.vcsdd/features/blockrun-cli-funding-dx/verification/security-results/semgrep-raw.json`
- **Result**: 210 rules run, 6 files scanned, **1 finding** (semgrep reports it as "blocking" in its own summary; severity field in the JSON is `WARNING`).

**Finding**: `javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp` at `src/core/errors.ts:71` — `new RegExp(\`(^|[^0-9.])${code}($|[^0-9.])\`)` inside `classifyKnownError()`'s local `hasStatus` helper. Semgrep's generic rule flags any `RegExp()` constructed from a template literal as a potential ReDoS vector if the interpolated value were attacker-controlled.

**Disposition — NOT a new finding introduced by this feature, and a false positive on inspection**:
1. `git diff eeee0e3..HEAD -- src/core/errors.ts` shows this feature's only change to `errors.ts` is 6 added lines inside `formatError()` (the REQ-FUND-011 "Prefer a card? Run: blockrun wallet --action deposit" hint), which does not touch `classifyKnownError()` or line 71 at all. The flagged code pre-dates this feature (present at `eeee0e3` already).
2. `hasStatus(code)` is called only twice in the same file, both with hardcoded string literals (`hasStatus("500")`, `hasStatus("402")`) — `code` is never derived from user input, network response bodies, or CLI flags; it is a fixed internal constant at every call site. There is no attacker-reachable path to a variable-length or adversarial `code` value, so the ReDoS concern the rule warns about does not apply here.
- **Verdict**: no action required for this feature. Recorded for completeness; not a regression and not blocking Phase 5→6 for this feature's scope.

## Manual audit — onQuote zero-cap guard coverage

`grep -rn "payOnce(" src/commands/` finds 3 direct call sites: `src/commands/wallet.ts` (deposit), `src/commands/speech.ts`, `src/commands/realface.ts`. All 3 supply an `onQuote` callback:
- `wallet.ts` (deposit, this feature): `onQuote: (quotedUsd) => { if (quotedUsd !== null && quotedUsd > 0) throw new Error(...) }` — a **zero-cap** guard (this endpoint is expected to always quote $0; any non-zero quote aborts before signing).
- `speech.ts` / `realface.ts`: `onQuote: (quotedUsd) => { const check = gated.paid.reverify(quotedUsd); if (!check.allowed) throw new Error(...) }` — a **budget-reverify** guard (these are genuinely paid commands; the guard re-checks the real 402-quoted amount against the ephemeral + persisted budget caps before signing).

`src/commands/image.ts`, `video.ts`, `music.ts` do **not** call `payOnce(` directly — their Solana-chain path calls `solanaPaidPost()` (`src/shell/solana-x402.ts`), a parallel paid-x402 helper for Solana, which also receives an `onQuote` callback wired to the same `gated.paid.reverify()` pattern (confirmed: `onQuote:` present at `image.ts:64`, `video.ts:49`, `music.ts:43`, all inside a `solanaPaidPost(...)` call). Their Base-chain path uses the `@blockrun/llm` SDK client directly (pre-settled cost commit, no live 402 negotiation in CLI-owned code) — this is pre-existing architecture unrelated to this feature's diff, not a gap introduced here.

**Architectural confirmation that the guard actually runs before signing** (not just present syntactically): read `src/shell/manual-x402.ts`'s `probeAndSign()` — `if (req.onQuote) req.onQuote(quotedUsd);` executes at line 68, strictly BEFORE `createPaymentPayload(...)` (the signing call) at line 70. So every `onQuote` guard across all 5 paid commands (image/video/music/speech/realface) plus `wallet`'s deposit genuinely runs before any payment payload is ever signed — a thrown guard aborts the whole `payOnce`/Solana-paid call with no signature produced. This matches PROP-FUND-014's design intent and is verified here at the shared-helper level, not merely per-call-site.

**Verdict**: every paid command's guard construction is present and structurally sound; the deposit path's zero-cap guard specifically throws when `quotedUsd !== null && quotedUsd > 0` as required, and no paid command signs before its quote guard has had a chance to abort.

## Secrets sweep

- **Command**: `git diff eeee0e3..HEAD -- src/ test/ | grep -iE 'api[_-]?key|secret|password|private[_-]?key|token.*=.*[a-z0-9]{20}'`
- **Raw output**: `.vcsdd/features/blockrun-cli-funding-dx/verification/security-results/secrets-sweep.txt`
- **Result**: grep exit code 1 (no matches). No hardcoded secrets, API keys, passwords, or private-key-shaped literals were introduced in this feature's diff.

## Critical finding — URL-open validation and shell-injection safety of `--open`

Orchestrator-supplied claim verified against the actual current file content (line numbers shifted slightly from the orchestrator's summary — verified here, not trusted blind):

- `src/commands/wallet.ts:163-165` (current `HEAD`, not 165-166 as summarized):
  ```ts
  const url = result.data.url;
  if (typeof url !== "string" || !url.startsWith("https://pay.coinbase.com/")) {
    throw new Error("gateway returned no Coinbase Onramp URL");
  }
  ```
  This check runs and can throw BEFORE line 167:
  ```ts
  const opened = open === true ? await openUrl(url) : false;
  ```
  Because this whole block sits inside the `try { ... } catch (err) { ... }` at lines 151-178, a URL that fails the `https://pay.coinbase.com/` prefix check throws and is caught by the `catch` at line 171, which produces the "couldn't create a card top-up link" fallback response — `openUrl(url)` is **never reached** for a non-Coinbase URL. Confirmed by reading the live file, not assumed from the prompt's summary.
- **Verdict on validation**: opening an arbitrary/unvalidated URL via `--open` is **NOT possible** through this code path — every URL passed to `openUrl()` has already been confirmed to start with the literal string `https://pay.coinbase.com/` on the same request. There is no code path where a server-controlled or attacker-controlled URL of a different origin reaches `openUrl()`.
- **Verdict on `spawn()` argv-array safety** (`src/shell/qr.ts:74`, `openUrl()`): `openerCommand()` returns `{ cmd, args }` where `args(url)` produces an array (`[url]` on darwin/linux, `["/c", "start", "", url]` on win32), and the call is `spawn(cmd, args(url), { detached: true, stdio: "ignore" })` — Node's `child_process.spawn` with an argv array does **not** invoke a shell to parse the command line (unlike `exec`/`execSync` with a single command string, or `spawn(..., { shell: true })`), so shell metacharacters embedded in `url` (`;`, `|`, `` ` ``, `$()`, etc.) are passed as a single literal argv element to the OS opener binary, not interpreted by any shell. This is safe from classic shell-injection regardless of the URL-validation question above — confirmed by reading `qr.ts`'s current `openerCommand()`/`openUrl()` implementation directly (no `shell: true` option present anywhere in the file).
- **Combined verdict**: both properties hold independently and compound: (1) only a verified `https://pay.coinbase.com/`-prefixed URL can ever reach `openUrl()`, and (2) even if it could not, the `spawn()` argv-array form would still not be exploitable for shell injection. No BLOCKING finding here.

## Summary

- Semgrep: 1 WARNING-severity finding, pre-existing (not introduced by this feature's diff), false positive on inspection (hardcoded literal call sites only) — no action required.
- Wycheproof / crypto test vectors: not applicable — no new cryptographic code in this feature.
- Paid-command `onQuote` guard coverage: complete across all `payOnce(`/`solanaPaidPost(` call sites (wallet-deposit zero-cap guard + speech/realface/image/video/music budget-reverify guards); guard execution architecturally precedes payment-payload signing in the shared `probeAndSign()` helper.
- Secrets sweep: clean, no matches.
- `--open` URL-open path: validated as Coinbase-Onramp-origin-only BEFORE reaching `openUrl()`; `spawn()` uses the argv-array form (no shell interpretation) regardless.
- **No BLOCKING security findings for this feature.**
