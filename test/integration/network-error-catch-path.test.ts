// Run with: npm test (tsx --test --experimental-test-module-mocks)
// PROP-DX-006 (REQ-DX-011's network_error, REQ-DX-015). REWRITTEN in spec per
// spec-review it-1 SPEC-DX-2 / it-2 SPEC-DX-4: proves the REAL Node fetch-failure
// shape reaches a REAL command's fail() output (exitCode 4, code "network_error"),
// not just that a classifier function looks right when fed a string directly. Covers
// BOTH a paid, gated command (defi — its catch block already routed through
// extractErrorMessage()) and a free, ungated command (dex — did NOT, until
// REQ-DX-017's fix), per the spec's explicit requirement to test both shapes.
//
// Each test uses the test-context-scoped `t.mock.module(...)` (not the global
// `mock.module(...)`) — it auto-restores after the test, which is REQUIRED here since
// two of these tests mock the SAME "../../src/shell/wallet.js" specifier with
// different rejection shapes; a global mock.module() call for an already-mocked
// specifier throws ERR_INVALID_STATE.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BudgetState } from "../../src/types.js";
import { isTimeoutError as realIsTimeoutError } from "../../src/shell/http.js";

function newBudget(): BudgetState {
  return { limit: null, spent: 0, calls: 0, agents: new Map() };
}

function fetchFailedWithCause(code: string): Error {
  const cause = Object.assign(new Error(code === "ENOTFOUND" ? `getaddrinfo ${code}` : code), { code });
  return Object.assign(new TypeError("fetch failed"), { cause });
}

test("PROP-DX-006 (defi, paid-path exemplar): a real getWithPaymentRaw() rejection with the live-verified ECONNREFUSED shape reaches fail() as exitCode 4 / code 'network_error'", async (t) => {
  t.mock.module("../../src/shell/wallet.js", {
    namedExports: {
      getClient: () => ({
        getWithPaymentRaw: async () => {
          throw fetchFailedWithCause("ECONNREFUSED");
        },
      }),
    },
  });
  const { run } = await import("../../src/commands/defi.js");
  const budget = newBudget();
  const outcome = await run({ path: "chains" }, { json: true }, budget);
  assert.equal(outcome.exitCode, 4, `defi's real catch path must classify a real ECONNREFUSED fetch failure as exit code 4 — got stdout: ${outcome.stdout}`);
  const parsed = JSON.parse(outcome.stdout) as { code?: string };
  assert.equal(parsed.code, "network_error");
});

test("PROP-DX-006 (defi, paid-path exemplar): a real getWithPaymentRaw() rejection with the live-verified TimeoutError shape reaches fail() as exitCode 4 / code 'network_error'", async (t) => {
  t.mock.module("../../src/shell/wallet.js", {
    namedExports: {
      getClient: () => ({
        getWithPaymentRaw: async () => {
          throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
        },
      }),
    },
  });
  const { run } = await import("../../src/commands/defi.js");
  const budget = newBudget();
  const outcome = await run({ path: "chains" }, { json: true }, budget);
  assert.equal(outcome.exitCode, 4, `defi's real catch path must classify a real TimeoutError as exit code 4 — got stdout: ${outcome.stdout}`);
  const parsed = JSON.parse(outcome.stdout) as { code?: string };
  assert.equal(parsed.code, "network_error");
});

test("PROP-DX-006 (dex, free/ungated exemplar): a real fetchJson() rejection with the live-verified ENOTFOUND shape reaches fail() as exitCode 4 / code 'network_error' — this is the case REQ-DX-017's dex.ts fix specifically closes", async (t) => {
  t.mock.module("../../src/shell/http.js", {
    namedExports: {
      isTimeoutError: realIsTimeoutError,
      fetchJson: async () => {
        throw fetchFailedWithCause("ENOTFOUND");
      },
    },
  });
  const { run } = await import("../../src/commands/dex.js");
  const budget = newBudget();
  const outcome = await run({ query: "eth" }, { json: true }, budget);
  assert.equal(outcome.exitCode, 4, `dex's real catch path must classify a real ENOTFOUND fetch failure as exit code 4 (requires REQ-DX-015 AND REQ-DX-017 both applied) — got stdout: ${outcome.stdout}`);
  const parsed = JSON.parse(outcome.stdout) as { code?: string };
  assert.equal(parsed.code, "network_error");
});
