// Run with: npm test (tsx --test)
// PROP-116 (REQ-137–143). Action/flag validation for the RealFace subcommand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest } from "../../src/args/realface.js";

test("REQ-137/REQ-138: init requires name (1-64 chars)", () => {
  assert.equal(buildRequest({ action: "init" }).ok, false, "missing name");
  assert.equal(buildRequest({ action: "init", name: "" }).ok, false, "empty name");
  assert.equal(buildRequest({ action: "init", name: "a".repeat(65) }).ok, false, "too long");
  assert.equal(buildRequest({ action: "init", name: "Alice" }).ok, true);
  assert.equal(buildRequest({ action: "init", name: "a".repeat(64) }).ok, true, "exactly 64 is allowed");
});

test("REQ-139: status requires group_id", () => {
  assert.equal(buildRequest({ action: "status" }).ok, false);
  assert.equal(buildRequest({ action: "status", groupId: "legacy_rf_123" }).ok, true);
});

test("group_id must match ^legacy_rf_\\d+$", () => {
  assert.equal(buildRequest({ action: "status", groupId: "bogus" }).ok, false);
  assert.equal(buildRequest({ action: "status", groupId: "legacy_rf_" }).ok, false);
});

test("REQ-140: enroll requires name, image_url, and group_id", () => {
  assert.equal(buildRequest({ action: "enroll", name: "Alice", groupId: "legacy_rf_1" }).ok, false, "missing image_url");
  assert.equal(buildRequest({ action: "enroll", name: "Alice", imageUrl: "https://x/a.png" }).ok, false, "missing group_id");
  assert.equal(
    buildRequest({ action: "enroll", name: "Alice", imageUrl: "https://x/a.png", groupId: "legacy_rf_1" }).ok,
    true,
  );
});

test("REQ-141: portrait requires name and image_url, no group_id/liveness needed", () => {
  assert.equal(buildRequest({ action: "portrait", name: "Zed" }).ok, false, "missing image_url");
  assert.equal(buildRequest({ action: "portrait", name: "Zed", imageUrl: "https://x/z.png" }).ok, true);
});

test("REQ-142: list requires nothing beyond the action", () => {
  assert.equal(buildRequest({ action: "list" }).ok, true);
});

test("image_url must be a well-formed URL (schema is z.string().url(), no protocol restriction per REQ-137)", () => {
  assert.equal(buildRequest({ action: "portrait", name: "Zed", imageUrl: "not-a-url" }).ok, false);
  assert.equal(buildRequest({ action: "portrait", name: "Zed", imageUrl: "http://example.com/z.png" }).ok, true, "http (not just https) is schema-valid per REQ-137");
});

test("unknown action is rejected", () => {
  assert.equal(buildRequest({ action: "teleport" }).ok, false);
});

test("codex-impl-review-1 #3: --image-url pointed at a private/loopback/link-local host is rejected locally", () => {
  assert.equal(buildRequest({ action: "portrait", name: "Zed", imageUrl: "http://127.0.0.1/z.png" }).ok, false);
  assert.equal(buildRequest({ action: "portrait", name: "Zed", imageUrl: "http://169.254.169.254/latest/meta-data/" }).ok, false);
  assert.equal(buildRequest({ action: "portrait", name: "Zed", imageUrl: "http://example.com/z.png" }).ok, true, "a public host is unaffected");
});
