# Security Hardening Report — blockrun-cli-pack-fix (Phase 5)

## Tooling

Static analysis: `semgrep --config auto` (v1.168.0, 210 community rules applied) over the three files
this feature touches at the source-code level:

- `scripts/generate-cost-model.mjs` (new — build-time generator)
- `src/core/cost-model.generated.ts` (new — committed generated output)
- `src/core/cost-model.ts` (rewritten — thin re-export)

Command: `semgrep --config auto scripts/generate-cost-model.mjs src/core/cost-model.generated.ts
src/core/cost-model.ts --json`

Result: **0 findings, 0 errors, 210 rules run across 3 files, ~100% parse coverage.** Raw JSON output
saved to `security-results/semgrep-cost-model.json`; scan-summary stderr saved to
`security-results/semgrep-cost-model.stderr.log`.

## Manual review — injection / path traversal in the generator

`scripts/generate-cost-model.mjs` is the only NEW file in this feature that touches the filesystem.
Reviewed every `fs`/path call in it:

```js
const __dirname = path.dirname(fileURLToPath(import.meta.url));   // fixed: this script's own location
const REPO_ROOT = path.resolve(__dirname, "..");                   // fixed: one level up from scripts/
const COMMANDS_DIR = path.join(REPO_ROOT, "src", "commands");      // fixed, hardcoded relative segment
const OUT_PATH = path.join(REPO_ROOT, "src", "core", "cost-model.generated.ts"); // fixed, hardcoded

readdirSync(COMMANDS_DIR)              // lists a fixed, repo-relative directory — no external input
readFileSync(path.join(COMMANDS_DIR, file), "utf8")  // `file` comes from readdirSync's own output,
                                                       // not from any CLI arg / env var / network input
writeFileSync(OUT_PATH, contents, "utf8")             // writes to a single fixed, hardcoded path
```

Findings:
- **No user-controlled input anywhere in this script.** It takes zero CLI arguments, reads zero
  environment variables, and makes zero network calls. Every path it touches (`REPO_ROOT`,
  `COMMANDS_DIR`, `OUT_PATH`) is derived purely from the script's own `import.meta.url` and hardcoded
  string segments (`"src"`, `"commands"`, `"core"`, `"cost-model.generated.ts"`) — there is no
  concatenation of any external value into a path, so **path traversal is not reachable**: an attacker
  would need write access to the repo checkout itself (out of scope — that's arbitrary code execution
  already) to influence what this script reads or writes.
- The only "input" is the CONTENT of files inside `COMMANDS_DIR` (via `src.includes("gatePaidCall(")`),
  used solely as a boolean membership test to classify `"free"` vs `"paid"` — the string is never
  `eval`'d, never passed to a shell, never interpolated into a path. **No injection vector.**
- This is a **dev-only / build-time script**: `scripts/` is not in `package.json`'s `"files"` array, so
  it is never shipped in the published npm package and never executes on an end user's machine — its
  entire attack surface is the maintainer's own local build/CI environment, which already has full repo
  write access.
- `src/core/cost-model.generated.ts` (the generator's OUTPUT) contains **zero runtime `fs`/path/
  `import.meta.url` calls** — confirmed by grep (`readFileSync|readdirSync|import.meta.url|process.cwd|
  __dirname` → no matches in the generated file or in the re-exporting `cost-model.ts`, the one
  match found is a historical explanatory code comment, not executable code). The built `dist/index.js`
  bundle was also grepped directly: zero occurrences of `findCommandsDir`/`COMMANDS_DIR` (the old
  runtime-scan logic is completely gone from the shipped artifact) and the `src/commands/*.ts` string
  fragments that do appear in the bundle are tsup's own auto-inserted source-boundary comments (e.g.
  `// src/commands/wallet.ts`), not live path-resolution code.

## Secrets sweep

Scope: full feature diff, `git diff dbb2033..HEAD -- scripts/generate-cost-model.mjs
src/core/cost-model.generated.ts src/core/cost-model.ts package.json test/cli/packed-tarball.test.ts
test/unit/cost-model-generated-parity.test.ts` (280 lines).

Pattern sweep for credential-shaped strings (`api[_-]?key`, `secret`, `password`, `token`, PEM private-key
headers, AWS `AKIA...`, GitHub `ghp_...`, OpenAI-style `sk-...`): **zero matches.** The diff is
exclusively build-tooling, a generated literal-object module, a thin re-export, and two new test files —
no credentials, no hardcoded endpoints requiring auth, nothing sensitive.

## Summary

| Check | Result |
|---|---|
| semgrep (210 rules, 3 files) | 0 findings |
| Path traversal / injection (manual, generator script) | Not reachable — zero external input, all paths hardcoded |
| Runtime fs access in generated/re-export files | None (confirmed by grep + built-bundle inspection) |
| Secrets sweep (feature diff, 280 lines) | Clean, 0 matches |

No security findings. This is a build-time-only code-generation change with no new runtime attack
surface — if anything, it REDUCES attack surface versus the prior version, which performed
runtime filesystem scans (`readFileSync`/`readdirSync` at module-load time) that no longer exist in the
shipped `dist/index.js`. Phase 5 security hardening: **PASS**.
