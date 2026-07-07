// Run with: npm test (tsx --test)
// PROP-110 (REQ-123–129). Cost estimator is a verbatim port of image.ts's
// estimateCost/isLargerThanBase (verification-architecture.md §1.1 cost/image.ts).
// Args validation covers the edit-mode gates (model set, image count cap, mask rules).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, isLargerThanBase } from "../../src/core/cost/image.js";
import { buildRequest } from "../../src/args/image.js";

test("REQ-128: estimateCost uses the per-model base price at 1024x1024", () => {
  assert.equal(estimateCost("openai/gpt-image-2", "1024x1024"), 0.06);
  assert.equal(estimateCost("openai/gpt-image-1", "1024x1024"), 0.02);
  assert.equal(estimateCost("google/nano-banana", "1024x1024"), 0.05);
  assert.equal(estimateCost("google/nano-banana-pro", "1024x1024"), 0.1);
  assert.equal(estimateCost("xai/grok-imagine-image", "1024x1024"), 0.02);
  assert.equal(estimateCost("xai/grok-imagine-image-pro", "1024x1024"), 0.07);
  assert.equal(estimateCost("zai/cogview-4", "1024x1024"), 0.015);
});

test("REQ-128: estimateCost upgrades to the large-size price only when a dimension exceeds 1024", () => {
  assert.equal(estimateCost("openai/gpt-image-2", "1536x1024"), 0.12);
  assert.equal(estimateCost("openai/gpt-image-1", "1024x1536"), 0.04);
  assert.equal(estimateCost("google/nano-banana-pro", "4096x4096"), 0.15);
  assert.equal(estimateCost("openai/gpt-image-2", "512x512"), 0.06, "smaller than base is not upgraded");
});

test("REQ-128: isLargerThanBase only trips when max(w,h) > 1024, tolerates casing/spacing typos", () => {
  assert.equal(isLargerThanBase("1024x1024"), false);
  assert.equal(isLargerThanBase("1536x1024"), true);
  assert.equal(isLargerThanBase("512x512"), false);
  assert.equal(isLargerThanBase("1024X1024"), false);
  assert.equal(isLargerThanBase(" 1024 x 1024 "), false);
  assert.equal(isLargerThanBase("garbage"), false, "unrecognized size never over-charges");
});

test("REQ-126: edit action requires an image", () => {
  const r = buildRequest({ prompt: "a cube", action: "edit" });
  assert.equal(r.ok, false);
});

test("REQ-126: edit rejects a model outside the edit-capable set", () => {
  const r = buildRequest({ prompt: "a cube", action: "edit", model: "xai/grok-imagine-image", image: "https://x/a.png" });
  assert.equal(r.ok, false);
});

test("REQ-126: edit enforces the per-provider max source-image count (openai<=4, google<=3)", () => {
  const okOpenai = buildRequest({ prompt: "p", action: "edit", model: "openai/gpt-image-2", image: ["a", "b", "c", "d"] });
  assert.equal(okOpenai.ok, true);
  const tooManyOpenai = buildRequest({ prompt: "p", action: "edit", model: "openai/gpt-image-2", image: ["a", "b", "c", "d", "e"] });
  assert.equal(tooManyOpenai.ok, false);
  const tooManyGoogle = buildRequest({ prompt: "p", action: "edit", model: "google/nano-banana", image: ["a", "b", "c", "d"] });
  assert.equal(tooManyGoogle.ok, false);
});

test("REQ-126: mask cannot combine with multiple source images", () => {
  const r = buildRequest({ prompt: "p", action: "edit", model: "openai/gpt-image-2", image: ["a", "b"], mask: "m" });
  assert.equal(r.ok, false);
});

test("REQ-126: mask is rejected on non-OpenAI models", () => {
  const r = buildRequest({ prompt: "p", action: "edit", model: "google/nano-banana", image: "a", mask: "m" });
  assert.equal(r.ok, false);
});

test("REQ-126: a valid single-image edit with mask on an OpenAI model passes", () => {
  const r = buildRequest({ prompt: "p", action: "edit", model: "openai/gpt-image-2", image: "a", mask: "m" });
  assert.equal(r.ok, true);
});

test("REQ-005: size/quality default when omitted (generate action)", () => {
  const r = buildRequest({ prompt: "a cat" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.size, "1024x1024");
    assert.equal(r.value.quality, "standard");
    assert.equal(r.value.action, "generate");
  }
});
