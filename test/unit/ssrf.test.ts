// Run with: npm test (tsx --test)
// Verbatim port of blockrun-mcp's own ssrf test cases — src/core/ssrf.ts is a
// byte-for-byte port of the clone's src/utils/ssrf.ts (verification-architecture.md §1.1).
// Fixture list mirrors verification-architecture.md §5's "127.0.0.1, 169.254.169.254,
// 10.0.0.1, etc." SSRF guard parity check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedFetchHost } from "../../src/core/ssrf.js";

test("isBlockedFetchHost blocks loopback", () => {
  assert.equal(isBlockedFetchHost("127.0.0.1"), true);
  assert.equal(isBlockedFetchHost("localhost"), true);
  assert.equal(isBlockedFetchHost("foo.localhost"), true);
  assert.equal(isBlockedFetchHost("localhost."), true);
});

test("isBlockedFetchHost blocks the cloud metadata endpoint and other link-local addresses", () => {
  assert.equal(isBlockedFetchHost("169.254.169.254"), true);
  assert.equal(isBlockedFetchHost("169.254.0.1"), true);
});

test("isBlockedFetchHost blocks RFC1918 private ranges", () => {
  assert.equal(isBlockedFetchHost("10.0.0.1"), true);
  assert.equal(isBlockedFetchHost("172.16.0.1"), true);
  assert.equal(isBlockedFetchHost("172.31.255.255"), true);
  assert.equal(isBlockedFetchHost("192.168.1.1"), true);
});

test("isBlockedFetchHost blocks CGNAT and internal/local TLD-style names", () => {
  assert.equal(isBlockedFetchHost("100.64.0.1"), true);
  assert.equal(isBlockedFetchHost("metadata.google.internal"), true);
  assert.equal(isBlockedFetchHost("myserver.local"), true);
});

test("isBlockedFetchHost blocks IPv6 loopback/unique-local/link-local, including IPv4-mapped forms", () => {
  assert.equal(isBlockedFetchHost("::1"), true);
  assert.equal(isBlockedFetchHost("fc00::1"), true);
  assert.equal(isBlockedFetchHost("fd12::1"), true);
  assert.equal(isBlockedFetchHost("fe80::1"), true);
  assert.equal(isBlockedFetchHost("[::1]"), true);
  assert.equal(isBlockedFetchHost("::ffff:127.0.0.1"), true);
  assert.equal(isBlockedFetchHost("::ffff:7f00:1"), true, "hex-compressed IPv4-mapped loopback");
});

test("isBlockedFetchHost allows legitimate public hosts", () => {
  assert.equal(isBlockedFetchHost("blockrun.ai"), false);
  assert.equal(isBlockedFetchHost("example.com"), false);
  assert.equal(isBlockedFetchHost("8.8.8.8"), false);
  assert.equal(isBlockedFetchHost("2001:4860:4860::8888"), false);
});
