// Run with: npm test (tsx --test)
// PROP-113 (REQ-130–136). No dedicated cost/video.ts module is listed in
// verification-architecture.md §1.1 (only the 10 named cost/*.ts ports are), so this
// per-second cost table + the mutual-exclusion/duration validations live directly in
// src/args/video.ts (documented in decisions.md §"cost function placement").
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, estimateVideoCost } from "../../src/args/video.js";

test("REQ-131/REQ-136: estimateVideoCost uses the text-to-video per-second rate and the model's default duration", () => {
  assert.equal(estimateVideoCost("xai/grok-imagine-video", undefined, false), 0.05 * 8);
  assert.equal(estimateVideoCost("azure/sora-2", undefined, false), 0.1 * 4);
  assert.equal(estimateVideoCost("bytedance/seedance-1.5-pro", undefined, false), 0.092 * 5);
});

test("REQ-130: estimateVideoCost respects an explicit duration_seconds", () => {
  assert.equal(estimateVideoCost("xai/grok-imagine-video", 1, false), 0.05 * 1);
});

test("REQ-130: image-input (seed image or RealFace) uses the cheaper image-to-video per-second tier", () => {
  assert.equal(estimateVideoCost("bytedance/seedance-2.0-fast", 5, true), 0.14 * 5);
  assert.equal(estimateVideoCost("bytedance/seedance-2.0", 5, true), 0.183 * 5);
});

test("REQ-132: azure/sora-2 rejects any duration_seconds other than 4, 8, or 12", () => {
  assert.equal(buildRequest({ prompt: "p", model: "azure/sora-2", durationSeconds: 5 }).ok, false);
  assert.equal(buildRequest({ prompt: "p", model: "azure/sora-2", durationSeconds: 4 }).ok, true);
  assert.equal(buildRequest({ prompt: "p", model: "azure/sora-2", durationSeconds: 8 }).ok, true);
  assert.equal(buildRequest({ prompt: "p", model: "azure/sora-2", durationSeconds: 12 }).ok, true);
});

test("REQ-132: a non-sora-2 model is NOT constrained to 4/8/12", () => {
  assert.equal(buildRequest({ prompt: "p", model: "xai/grok-imagine-video", durationSeconds: 5 }).ok, true);
});

test("REQ-130: real_face_asset_id and image_url are mutually exclusive", () => {
  const r = buildRequest({ prompt: "p", realFaceAssetId: "ta_abc123", imageUrl: "https://x/a.png" });
  assert.equal(r.ok, false);
});

test("REQ-130: real_face_asset_id requires a Seedance-2.0-family model", () => {
  const r = buildRequest({ prompt: "p", realFaceAssetId: "ta_abc123", model: "xai/grok-imagine-video" });
  assert.equal(r.ok, false);
  const ok = buildRequest({ prompt: "p", realFaceAssetId: "ta_abc123", model: "bytedance/seedance-2.0" });
  assert.equal(ok.ok, true);
});

test("REQ-130: last_frame_url requires image_url and excludes real_face_asset_id", () => {
  assert.equal(buildRequest({ prompt: "p", lastFrameUrl: "https://x/b.png" }).ok, false, "no image_url");
  assert.equal(
    buildRequest({ prompt: "p", imageUrl: "https://x/a.png", realFaceAssetId: "ta_abc123", model: "bytedance/seedance-2.0", lastFrameUrl: "https://x/b.png" }).ok,
    false,
    "cannot combine with real_face_asset_id",
  );
  assert.equal(buildRequest({ prompt: "p", imageUrl: "https://x/a.png", lastFrameUrl: "https://x/b.png" }).ok, true);
});
