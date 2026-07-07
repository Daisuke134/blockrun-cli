# Purity Audit — blockrun-cli (Phase 5, sprint 1)

Scope: `verification-architecture.md` §1 purity boundary. Method: `grep -rn` over the pure-core
tree for every impurity signal named in the task brief, cross-checked line-by-line against each
file's actual imports, followed by manual read of every file that had a hit.

## 1. `src/core/*.ts` — pure core

Command run:

```
grep -rn "node:fs\|from 'fs'\|from \"fs\"\|from 'node:fs'\|undici\|@blockrun\|process\.\|fetch(" src/core/
```

Result: **2 matches, both in comments, zero in code.**

```
src/core/budget-limit.ts:2:// Pure: takes already-parsed plain arguments only, never touches process.env or
src/core/budget-limit.ts:3:// ~/.blockrun/cli-budget.json itself — the impure shell reads process.env and passes
```

Both lines are `//` comments describing the boundary, not executable references to `process.*`.
No file under `src/core/` contains an executable `fetch(`, `fs`/`node:fs` import, `@blockrun/*`
import, or a live `process.*` read. Also checked and clean: `Date.now()` / `Math.random()` (zero
hits — no hidden nondeterminism).

Import audit (every `import` statement in every `src/core/*.ts` file, 17 files total including
`src/core/cost/*.ts`): every import target resolves to another file under `src/core/` (`./budget.js`,
`./errors.js`, `../path-safety.js`, `../types.js`) or is type-only. No file imports anything from
`src/shell/`, `src/commands/`, or an npm package other than the internal core modules. **Verdict:
CLEAN.**

## 2. `src/args/*.ts` — also pure per §1.1's `args/<command>.ts` row

The verification-architecture table places `args/<command>.ts` in the pure-core layer (§1.1) even
though it physically lives at `src/args/` rather than under `src/core/`. Audited the same way:

```
grep -rn "node:fs\|from 'fs'\|from \"fs\"\|undici\|@blockrun\|process\.\|fetch(" src/args/
```

Result: **zero matches.** All 18 `src/args/<command>.ts` files plus `shared.ts` import only from
`../core/*` and `zod`. **Verdict: CLEAN.**

## 3. Impurity fencing — is every impure operation confined to `src/shell/` and `src/commands/`?

```
grep -rln "@blockrun/llm" src/     → wallet.ts, solana-x402.ts, manual-x402.ts, image-fetch.ts, index.ts
grep -rln "fetch(" src/ (excluding shell/ and commands/)  → zero files
grep -rln "node:fs\|'fs'" src/     → wallet.ts, qr.ts, budget-store.ts, cli/json-flag.ts
```

Every `@blockrun/llm` import and every `fetch(` call site is inside `src/shell/*.ts` or
`src/commands/*.ts` (the one exception, `src/index.ts`, only imports `@blockrun/llm` for a
top-level version/health check at the entrypoint dispatch layer, which the architecture doc
explicitly scopes to `src/index.ts` as "process argv, process.exit" territory — not a pure-core
leak). `src/cli/json-flag.ts` reads a local file for `--param @file.json` (REQ-004) — this is a
CLI-parsing-layer concern, not `src/core/`, and is documented as such in the directory layout.
**Verdict: impurity is correctly fenced. No pure-core module performs I/O.**

## 4. Signing/EIP-712 confinement (feeds REQ-221/222, cross-referenced here since it's a purity-boundary question)

```
grep -rln "viem/accounts\|signTypedData\|privateKeyToAccount\|ecsign\|keccak256\|secp256k1\|@noble" src/
```

Only hit: `src/shell/manual-x402.ts` (imports `privateKeyToAccount` from `viem/accounts`, used
solely to derive `account.address` — a public-key derivation, not a signature — before handing the
raw private key to the SDK's own `createPaymentPayload()` at line 70, which performs the actual
EIP-712 signing internally). `src/shell/solana-x402.ts` uses only SDK-exported
`solanaKeyToBytes`/`solanaPublicKey`/`createSolanaPaymentPayload` from `@blockrun/llm` — no
Solana-side hand-rolled signing primitive anywhere in `src/`. **Verdict: CLEAN — signing is 100%
delegated to the SDK; the CLI never hand-constructs or hand-signs a payment payload.**

## 5. Single-chokepoint audit for `~/.blockrun/*` reads

Grep hit list for `.blockrun` outside `src/shell/wallet.ts`:

| File | Line | What it actually does |
|---|---|---|
| `src/core/cli-budget-schema.ts:2` | comment only | no I/O |
| `src/core/budget-limit.ts:3` | comment only | no I/O |
| `src/shell/solana-x402.ts:2` | comment only (`sol.blockrun.ai`, a hostname, not the dir) | no I/O |
| `src/shell/qr.ts:16` | `join(homedir(), ".blockrun")` | **writes** a non-secret QR PNG image to the directory; never reads `.session`/`.chain`/`.solana-session` |
| `src/shell/budget-store.ts:1,12` | `join(homedir(), ".blockrun")` | reads/writes `cli-budget.json` only |
| `src/commands/wallet.ts:3,94` | comments only | no I/O |
| `src/commands/shared.ts:3` | comment only | no I/O |

**Note on spec wording vs. actual design:** §5's grep-audit line reads "no file outside
`shell/wallet.ts` reads `~/.blockrun/*` directly," but §1.2's own module table assigns
`shell/budget-store.ts` as a **second, explicitly designated** chokepoint for
`~/.blockrun/cli-budget.json` (distinct from the wallet **session** files `.session`/`.chain`/
`.solana-session`, which only `wallet.ts` reads). This is a wording imprecision in §5, not a code
defect — treating §1.2 (the more specific, later-written module table) as authoritative, the actual
invariant holds: wallet session/private-key material is read from exactly one file
(`wallet.ts`); the budget ledger is read/written from exactly one other, separately-designated file
(`budget-store.ts`); and `qr.ts` only ever *writes* a public, non-secret artifact into the same
directory. No file outside these two designated shell modules touches `~/.blockrun/*` for secret
material. **Verdict: CLEAN (with the wording note above, non-blocking).**

## 6. Determinism certification

Every `src/core/*.ts` and `src/args/*.ts` function reviewed is a synchronous pure function or an
`async` wrapper with no awaited I/O (args files call zod `.safeParse` only). Given identical inputs,
each produces identical outputs — no clock, RNG, environment, or filesystem dependency. Certified
deterministic.

## Overall purity verdict: **CLEAN — no violations.** Nothing routes back to impl-builder.
