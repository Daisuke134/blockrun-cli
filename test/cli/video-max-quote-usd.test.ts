// Run with: npm test (tsx --test)
// PROP-114 (REQ-135a). Subprocess test against a LOCAL stub HTTP server (per
// verification-architecture.md §2.2's explicit requirement for this PROP), since
// shell/manual-x402.ts otherwise targets the real https://blockrun.ai/api. The stub is
// pointed at via BLOCKRUN_API_BASE_URL (decisions.md §11 — test-only override, not a
// user-facing feature). Two branches: (a) quote <= --max-quote-usd -> signs and
// completes; (b) quote > --max-quote-usd -> aborts BEFORE any payment signature is
// produced, nonzero exit, exact quote surfaced in both human and --json output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
      payTo: "0x0000000000000000000000000000000000dEaD",
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

function runCli(args: string[], apiBaseUrl: string, home: string) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, HOME: home, BLOCKRUN_API_BASE_URL: apiBaseUrl },
  });
}

test("REQ-135a: quote <= --max-quote-usd signs and completes (createPaymentPayload IS called)", async () => {
  const { server, url } = await startStubServer("cheap-completes");
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-quote-gate-cheap-"));
  try {
    const res = runCli(
      ["video", "a red cube spinning", "--model", "xai/grok-imagine-video", "--duration-seconds", "1", "--max-quote-usd", "0.10", "--json"],
      url, home,
    );
    assert.equal(res.status, 0, `expected success when quote <= cap\nstdout:${res.stdout}\nstderr:${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    assert.match(parsed.url ?? "", /fake\.mp4/);
  } finally {
    server.close();
  }
});

test("REQ-135a: quote > --max-quote-usd aborts BEFORE signing (createPaymentPayload is NEVER called), nonzero exit, quote in --json output", async () => {
  const { server, url, signedSubmit } = await startStubServer("expensive-must-not-sign");
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-quote-gate-expensive-"));
  try {
    const res = runCli(
      ["video", "a red cube spinning", "--model", "xai/grok-imagine-video", "--duration-seconds", "1", "--max-quote-usd", "0.10", "--json"],
      url, home,
    );
    assert.notEqual(res.status, 0, "must abort when the real quote exceeds --max-quote-usd");
    assert.equal(signedSubmit, false, "the stub must NEVER receive a PAYMENT-SIGNATURE — no signature is ever produced over the cap");
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.error, true);
    assert.match(parsed.message, /0\.5/, "the exact quoted amount ($0.50) must be surfaced in the JSON error");
  } finally {
    server.close();
  }
});

test("REQ-135a: quote > --max-quote-usd also surfaces the exact quote in the non-JSON human error text", async () => {
  const { server, url, signedSubmit } = await startStubServer("expensive-must-not-sign");
  const home = mkdtempSync(join(tmpdir(), "blockrun-cli-quote-gate-human-"));
  try {
    const res = runCli(
      ["video", "a red cube spinning", "--model", "xai/grok-imagine-video", "--duration-seconds", "1", "--max-quote-usd", "0.10"],
      url, home,
    );
    assert.notEqual(res.status, 0);
    assert.equal(signedSubmit, false);
    assert.match(res.stderr, /0\.5/, "the exact quoted amount must appear in the human-readable stderr message");
  } finally {
    server.close();
  }
});
