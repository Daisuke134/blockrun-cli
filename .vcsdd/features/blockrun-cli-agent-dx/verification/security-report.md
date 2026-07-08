# Security Hardening Report — blockrun-cli-agent-dx (Phase 5)

Feature: `blockrun-cli-agent-dx` · Mode: lean · Phase 5 (Formal Hardening)

## Tooling

- **semgrep 1.168.0** (`semgrep --config auto --json`) run over the 5 NEW files
  (`src/core/introspect-schema.ts`, `src/core/cost-model.ts`, `src/core/commands-catalog.ts`,
  `src/core/commands-render.ts`, `src/core/error-classification.ts`) plus the 4 changed files
  (`src/core/errors.ts`, `src/core/render.ts`, `src/shell/wallet.ts`, `src/commands/dex.ts`). Raw
  output: `verification/security-results/semgrep-output.json` (0 tool errors, 1 finding).
- Manual grep sweep (command-injection surface, hardcoded secrets, `eval`/`new Function`) over the
  same 9 files. Raw output: `verification/security-results/grep-sweep.txt`.
- `git diff 624906c..HEAD -- src/shell/wallet.ts src/commands/dex.ts src/core/render.ts` reviewed
  line-by-line for the exact delta introduced by this feature (wallet.ts/dex.ts/render.ts are
  pre-existing files with mechanical additions, not new files).

## Findings

### 1. `javascript.lang.security.audit.detect-non-literal-regexp` — `src/core/errors.ts:71` — WARNING

```ts
const hasStatus = (code: string) => new RegExp(`(^|[^0-9.])${code}($|[^0-9.])`).test(msgLower);
```

semgrep's rule flags any `new RegExp(...)` built from a template literal as non-literal (potential
ReDoS / regex-injection if `code` were attacker-controlled). **Verdict: false positive, not
exploitable.** Call-site audit (`grep -n hasStatus src/core/errors.ts`, recorded in
`grep-sweep.txt`) shows `hasStatus` is invoked at exactly 3 sites in this file, ALL with a hardcoded
string literal — `hasStatus("500")` (x2) and `hasStatus("402")` (x1). `code` never originates from
`message` (the untrusted error string) or any other external input; it is always one of two
fixed literals authored in this same file. Consequences ruled out:
- **Regex injection**: impossible — `code` is never derived from `message`/user input.
- **ReDoS**: impossible even if it were — the constructed pattern
  `(^|[^0-9.])500($|[^0-9.])` has no nested quantifiers or backtracking-prone constructs; it is a
  fixed-length, linear-time match regardless of `code`'s value.

No code change required. This is a structural false positive from semgrep's
interprocedural-analysis gap (it does not trace that `hasStatus`'s only 2 call sites both pass
literals). Recorded here rather than suppressed, per the instruction to record findings honestly
with an exploitability judgment.

### Manual grep sweep — 0 findings

- **Command injection surface** (`child_process`/`execSync`/`spawnSync`/`exec(`/`spawn(`): none of
  the 9 files shell out to a subprocess. `src/core/cost-model.ts` (flagged by the task brief as a
  file that "greps source files") reads its own sibling `src/commands/*.ts` files via Node's
  `readdirSync`/`readFileSync` against a `path.join()`-constructed, module-relative path
  (`findCommandsDir()`, `src/core/cost-model.ts:16-30`) — it never shells out to the `grep` binary,
  never accepts a path argument from user/CLI input, and never uses `path.join()` with
  attacker-controlled segments (the only two path candidates are `<module-dir>/../commands` and
  `<module-dir>/../src/commands`, both fixed relative to `import.meta.url`). No path-traversal or
  injection surface.
- **Hardcoded secrets**: none. The only `privateKey`-pattern matches in `src/shell/wallet.ts` are
  pre-existing (outside this feature's diff — confirmed via `git diff 624906c..HEAD`) variable
  names/types for the wallet's own key-management plumbing (`getOrCreateWalletKey()`,
  `LLMClient({ privateKey })`, etc.), not literal secret values embedded in source.
- **`eval`/`new Function`**: none present in any of the 9 files.

## Summary

| Check | Result |
|---|---|
| semgrep (5 new + 4 changed files) | 1 finding (non-literal-regexp, `errors.ts:71`) — false positive, not exploitable (literal-only call sites) |
| Command-injection grep | 0 findings |
| Hardcoded-secret grep | 0 findings |
| `eval`/`new Function` grep | 0 findings |
| `cost-model.ts` file-read safety | Fixed, module-relative paths only; no shell-out; no user-controlled path segments |

**Security verdict: PASS.** No exploitable vulnerability found in the new/changed surface. The one
semgrep warning is a documented false positive with call-site evidence, not a code change.
