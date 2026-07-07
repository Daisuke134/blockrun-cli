// Run with: npm test (tsx --test)
// PROP-114 (REQ-135a). Subprocess test against a LOCAL stub HTTP server (per
// verification-architecture.md §2.2's explicit requirement for this PROP), since
// shell/manual-x402.ts otherwise targets the real https://blockrun.ai/api. The stub is
// pointed at via BLOCKRUN_API_BASE_URL (decisions.md §11 — test-only override, not a
// user-facing feature). Two branches: (a) quote <= --max-quote-usd -> signs and
// completes; (b) quote > --max-quote-usd -> aborts BEFORE any payment signature is
// produced, nonzero exit, exact quote surfaced in both human and --json output.
//
// IMPORTANT (fixed per Green-phase escalation, sprint-1-green-phase.log): this MUST use
// async `spawn` + awaiting the child's exit, NOT `spawnSync`. `spawnSync` blocks the
// parent process's event loop synchronously until the child exits — since the stub
// HTTP server above runs IN-PROCESS (same event loop) via `node:http`, a `spawnSync`
// call would freeze the very server the spawned child needs to talk to, deadlocking
// every run until the child's own fetch timeout fires. Confirmed via a minimal repro
// with the same architecture (in-process http.createServer + spawnSync child fetching
// it): the server's request handler never runs while spawnSync blocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRY = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

function paymentRequiredHeader(amountAtomicUsdc: string): string {
  const paymentRequired = {
    x402Version: 1,
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
      amount: amountAtomicUsdc,
      maxAmountRequired: amountAtomicUsdc,
      // The well-known "dead address", 40 hex chars (20 bytes) — MUST be a valid EIP-55
      // address or the SDK's own createPaymentPayload()/getAddress() rejects it before
      // ever reaching the network, which would falsely look like this test's gate
      // working. (A prior draft of this fixture had only 38 hex chars — one byte short
      // — which viem's getAddress() correctly rejects; fixed here.)
      payTo: "0x000000000000000000000000000000000000dEaD",
      maxTimeoutSeconds: 600,
    }],
    resource: { url: "https://blockrun.ai/api/v1/videos/generations", description: "BlockRun Video Generation" },
  };
  return Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
}

// $0.05 quote (50000 atomic units, 6-decimal USDC) — under a $0.10 cap.
const CHEAP_QUOTE_HEADER = paymentRequiredHeader("50000");
// $0.50 quote (500000 atomic units) — over a $0.10 cap.
const EXPENSIVE_QUOTE_HEADER = paymentRequiredHeader("500000");

function startStubServer(mode: "cheap-completes" | "expensive-must-not-sign"): Promise<{ server: Server; url: string; signedSubmit: boolean }> {
  const state = { signedSubmit: false };
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const hasSignature = Boolean(req.headers["payment-signature"]);
      if (!hasSignature) {
        res.writeHead(402, {
          "content-type": "application/json",
          "payment-required": mode === "cheap-completes" ? CHEAP_QUOTE_HEADER : EXPENSIVE_QUOTE_HEADER,
        });
        res.end(JSON.stringify({ error: "payment required" }));
        return;
      }
      // A signed submit arriving here means createPaymentPayload WAS called — for the
      // "expensive" branch this must NEVER happen (asserted below via signedSubmit).
      state.signedSubmit = true;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        data: [{ url: "https://blockrun.ai/media/fake.mp4", duration_seconds: 1 }],
        model: "xai/grok-imagine-video",
      }));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}`, get signedSubmit() { return state.signedSubmit; } } as any);
    });
  });
}

interface CliResult { status: number | null; stdout: string; stderr: string }

// Async spawn + await, so the in-process stub server's event loop keeps running while
// the child is alive (see file-header note — this is the actual fix for the deadlock).
function runCli(args: string[], apiBaseUrl: string, home: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      env: { ...process.env, HOME: home, BLOCKRUN_API_BASE_URL: apiBaseUrl },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI did not exit within 20s\nstdout:${stdout}\nstderr:${stderr}`));
    }, 20_000);
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });
}

test("REQ-135a: quote <= --max-quote-usd signs and completes (createPaymentPayload IS called)", async () => {
  const stub = await startStubServer("cheap-completes");
  const { server, url } = stub;
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-quote-gate-cheap-"));
  try {
    const res = await runCli(
      ["video", "a red cube spinning", "--model", "xai/grok-imagine-video", "--duration-seconds", "1", "--max-quote-usd", "0.10", "--json"],
      url, home,
    );
    assert.equal(res.status, 0, `expected success when quote <= cap\nstdout:${res.stdout}\nstderr:${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    assert.match(parsed.url ?? "", /fake\.mp4/);
    assert.equal(stub.signedSubmit, true, "the cheap path must actually reach the stub with a signed PAYMENT-SIGNATURE submit");
  } finally {
    server.close();
  }
});

test("REQ-135a: quote > --max-quote-usd aborts BEFORE signing (createPaymentPayload is NEVER called), nonzero exit, quote in --json output", async () => {
  // NOTE (codex-impl-review-1 finding #5): keep the returned stub object and read
  // `.signedSubmit` (a getter) AFTER runCli() completes — destructuring it here would
  // invoke the getter immediately and capture the initial `false`, making the later
  // assertion vacuous (it would pass even if a PAYMENT-SIGNATURE request arrived).
  const stub = await startStubServer("expensive-must-not-sign");
  const { server, url } = stub;
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-quote-gate-expensive-"));
  try {
    const res = await runCli(
      ["video", "a red cube spinning", "--model", "xai/grok-imagine-video", "--duration-seconds", "1", "--max-quote-usd", "0.10", "--json"],
      url, home,
    );
    assert.notEqual(res.status, 0, "must abort when the real quote exceeds --max-quote-usd");
    assert.equal(stub.signedSubmit, false, "the stub must NEVER receive a PAYMENT-SIGNATURE — no signature is ever produced over the cap");
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.error, true);
    assert.match(parsed.message, /0\.5/, "the exact quoted amount ($0.50) must be surfaced in the JSON error");
  } finally {
    server.close();
  }
});

test("REQ-135a: quote > --max-quote-usd also surfaces the exact quote in the non-JSON human error text", async () => {
  const stub = await startStubServer("expensive-must-not-sign");
  const { server, url } = stub;
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-quote-gate-human-"));
  try {
    const res = await runCli(
      ["video", "a red cube spinning", "--model", "xai/grok-imagine-video", "--duration-seconds", "1", "--max-quote-usd", "0.10"],
      url, home,
    );
    assert.notEqual(res.status, 0);
    assert.equal(stub.signedSubmit, false, "the stub must NEVER receive a PAYMENT-SIGNATURE — no signature is ever produced over the cap");
    assert.match(res.stderr, /0\.5/, "the exact quoted amount must appear in the human-readable stderr message");
  } finally {
    server.close();
  }
});
