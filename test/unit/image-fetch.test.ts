// Run with: npm test (tsx --test)
// REQ-127, REQ-220 (codex-impl-review-1 blocking finding #3). toImageDataUri's SSRF
// guard runs BEFORE any fetch() call, so a blocked-host URL rejects hermetically here
// with zero network access — safe to exercise the real (unmocked) function directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toImageDataUri } from "../../src/shell/image-fetch.js";

test("toImageDataUri rejects a loopback URL before any network call (SSRF guard)", async () => {
  await assert.rejects(
    () => toImageDataUri("http://127.0.0.1/evil.png"),
    /private\/loopback\/link-local/,
  );
});

test("toImageDataUri rejects the cloud metadata endpoint", async () => {
  await assert.rejects(
    () => toImageDataUri("http://169.254.169.254/latest/meta-data/"),
    /private\/loopback\/link-local/,
  );
});

test("toImageDataUri rejects an RFC1918 private address", async () => {
  await assert.rejects(
    () => toImageDataUri("http://10.0.0.5/x.png"),
    /private\/loopback\/link-local/,
  );
});

test("toImageDataUri passes a data: URI through untouched (no fetch, no guard needed)", async () => {
  const dataUri = "data:image/png;base64,aGVsbG8=";
  assert.equal(await toImageDataUri(dataUri), dataUri);
});

test("toImageDataUri rejects an unsupported local file extension before reading it", async () => {
  await assert.rejects(
    () => toImageDataUri("/tmp/not-an-image.txt"),
    /unsupported image extension/,
  );
});
