# Security Hardening Report — blockrun-cli-docs (Phase 5)

Feature: `blockrun-cli-docs` · Mode: lean · Phase: 5 · Date: 2026-07-08

This is a docs/packaging feature (no application logic added — `src/` is read-only except one
authorized version-literal line, PROP-016b). The security sweep therefore focuses on: (1) secrets/
credential leakage across the produced docs and evidence artifacts, (2) confirmation that no credential
material was committed, and (3) a static-analysis pass over the one executable artifact this feature
did add, `scripts/docs-check.mjs`.

## Tooling

- **Secrets scan**: `/usr/bin/grep` (explicit binary, not the shell's aliased `grep` function — see
  correction note below) over README.md, CHANGELOG.md, CONTRIBUTING.md, PARITY.md, VERIFICATION.md,
  execution-notes.md, `specs/behavioral-spec.md`, `specs/verification-architecture.md`, and all
  `evidence/*.json`/`*.md` files this feature produced. Patterns: 64-hex-char `0x` strings (private-key-
  length candidates), `PRIVATE_KEY`/`SOLANA_WALLET_KEY` assignments with an actual value, bearer/API-key
  token patterns, mnemonic/seed-phrase indicators. Raw output saved to
  `verification/security-results/secrets-grep.txt`.
- **Committed-file review**: `git log --diff-filter=A --name-only eadc61c..HEAD` (feature-start commit
  `eadc61c` = `vcsdd(docs): init blockrun-cli-docs feature`) to review every file ADDED during this
  feature for env/key material.
- **Static analysis**: `semgrep --config auto scripts/docs-check.mjs` (semgrep 1.168.0, installed at
  `/opt/homebrew/bin/semgrep`, 200 rules run, ~100% parsed) — run because semgrep IS installed in this
  environment, so "not installed, grep-based sweep used" does not apply here.

### Correction note (methodology honesty)

The first attempt at the secrets grep silently produced a false "none found" for every pattern. Root
cause: zsh does not word-split an unquoted scalar variable (`$FILES` holding a space-separated file
list) the way bash does, so the multi-file grep call received the entire string as a single (non
-existent) filename and searched zero files while still exiting 0. This was caught by re-running with a
literal filename list, seeing real hits, and then fixing the reusable version with a zsh array
(`"${FILES[@]}"`) plus explicit `/usr/bin/grep`. The corrected, verified run is what this report and
`secrets-grep.txt` are based on — the false-negative version was overwritten, not left on disk.

## Findings

### 1. Secrets scan — 15 hits on the 64-hex-`0x` pattern, all classified benign

Every hit is a public on-chain transaction hash (`tx`/`txHash`, from `X-Payment-Receipt` headers), a
public Pyth price-feed ID (`feedId`), or the documented ERC-20 `balanceOf()` call-data construction
(`0x70a08231...`, ABI-encoded, publicly derivable from the wallet address). None matches a
`PRIVATE_KEY`/`SOLANA_WALLET_KEY` assignment pattern with an actual value — the only mentions of
"private key" in the docs are descriptive prose in README.md's Environment Variables table (lines
138/141/150) explaining what `~/.blockrun/.session` and `~/.blockrun/.solana-session` contain, without
printing their contents. No bearer/API-key tokens, no mnemonic/seed-phrase text found. Full context dump
in `security-results/secrets-grep.txt`.

**Verdict: PASS — no secret/credential material leaked into any docs or evidence artifact.** Wallet
*addresses* (e.g. `0xa5CeF4943c3F8f34e5138b5BcdE6B88746a5c804`, `0x810f6d61f7606deee2657d3083e150a222bc29c5`)
and transaction hashes appear throughout `VERIFICATION.md`/`PARITY.md`/`execution-notes.md` by design —
these are public blockchain data (per the task's own scope note) and are the required settlement-proof
evidence this feature's spec (DOC-EVID-004) mandates recording, not a leak.

### 2. Committed-file review — no env/key files added

`git log --diff-filter=A --name-only eadc61c..HEAD` lists every file this feature ADDED. The full list is
exclusively: docs artifacts (README.md's pre-existing modification doesn't count as "added"; CHANGELOG.md,
CONTRIBUTING.md, LICENSE were pre-existing/modified not added — confirmed via the broader `git diff
--name-only` in the verification-report's PROP-016 re-check), `scripts/docs-check.mjs`, and files entirely
under `.vcsdd/features/blockrun-cli-docs/{specs,reviews,evidence}/` (spec markdown, JSON verdicts, JSON
evidence records, `.log` execution transcripts, and the two media binary artifacts `image-fresh.png`/
`video-fresh.mp4`/`music-fresh.mp3`, which are the actual generated media content, not secrets). No `.env`,
no `*.pem`/`*.key`, no credential-shaped filename anywhere in the added-file list.

**Verdict: PASS — no credential material was committed.**

### 3. Static analysis of `scripts/docs-check.mjs` — 1 non-blocking WARNING

```
javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
scripts/docs-check.mjs:649
severity: WARNING
```

Flags `new RegExp(\`blockrun\\s+${name}\\b\`)` inside PROP-012's naming check as a non-literal RegExp
construction (generic ReDoS-pattern warning). In context: `name` is drawn from `realNames`, a fixed list
of the CLI's own 18 subcommand names (e.g. `"wallet"`, `"chat"`, `"image"`), parsed locally from `node
dist/index.js --help`'s own output — never from network input, user input, or any attacker-controlled
source. `docs-check.mjs` is a local, developer/agent-invoked verification script with no network listener
and no externally-reachable input surface; the values interpolated into the regex are short alphanumeric
command names with no nested-quantifier structure, so this is not an exploitable ReDoS in this script's
actual usage, despite matching semgrep's generic "non-literal RegExp" audit rule.

**Verdict: WARNING, non-blocking.** No fix required for this feature to pass hardening — recorded
honestly rather than suppressed.

## Summary

| Check | Result |
|---|---|
| Secrets scan (0x-64hex / PRIVATE_KEY / SOLANA_WALLET_KEY / bearer-token / mnemonic patterns) | PASS — 0 real secrets found (15 tx-hash/feedId/calldata hits, all classified benign) |
| Committed-file review (`git log --diff-filter=A`) | PASS — no env/key files added |
| Static analysis (semgrep, `scripts/docs-check.mjs`) | 1 WARNING, non-blocking (generic non-literal-RegExp audit rule; not exploitable given the fixed, local, non-attacker-controlled command-name input) |

**Overall Phase 5 security verdict: PASS.** No blocking finding. One informational static-analysis
warning recorded for completeness.
