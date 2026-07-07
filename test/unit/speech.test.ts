// Run with: npm test (tsx --test)
// PROP-122 (REQ-148–151). speechCost is a verbatim port of speech.ts's speechCost
// (verification-architecture.md §1.1 cost/speech.ts). Per-model char-cap validation
// and the sound_effect 1000-char cap are pure args-layer checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { speechCost, SOUND_EFFECT_COST } from "../../src/core/cost/speech.js";
import { buildRequest } from "../../src/args/speech.js";

test("REQ-151: speechCost = (chars/1000) * per-model rate * 1.05 margin", () => {
  assert.equal(Math.round(speechCost("elevenlabs/flash-v2.5", 1000) * 10000) / 10000, 0.0525);
  assert.equal(Math.round(speechCost("elevenlabs/multilingual-v2", 1000) * 10000) / 10000, 0.105);
});

test("REQ-151: speechCost floors at $0.001 for tiny inputs", () => {
  assert.equal(speechCost("elevenlabs/flash-v2.5", 1), 0.001);
});

test("REQ-151: SOUND_EFFECT_COST is the flat $0.05 * 1.05 margin", () => {
  assert.equal(Math.round(SOUND_EFFECT_COST * 10000) / 10000, 0.0525);
});

test("REQ-150: sound_effect input is capped at 1000 chars", () => {
  const r = buildRequest({ action: "sound_effect", input: "x".repeat(1001) });
  assert.equal(r.ok, false);
  const ok = buildRequest({ action: "sound_effect", input: "x".repeat(1000) });
  assert.equal(ok.ok, true);
});

test("REQ-150: speak caps input at the model's max chars (flash-v2.5: 40000, multilingual-v2: 10000, v3: 5000)", () => {
  assert.equal(buildRequest({ action: "speak", input: "x".repeat(40001), model: "elevenlabs/flash-v2.5" }).ok, false);
  assert.equal(buildRequest({ action: "speak", input: "x".repeat(40000), model: "elevenlabs/flash-v2.5" }).ok, true);
  assert.equal(buildRequest({ action: "speak", input: "x".repeat(5001), model: "elevenlabs/v3" }).ok, false);
});

test("REQ-149: voices action requires no input", () => {
  assert.equal(buildRequest({ action: "voices" }).ok, true);
});

test("REQ-148: speak/sound_effect require input", () => {
  assert.equal(buildRequest({ action: "speak" }).ok, false);
  assert.equal(buildRequest({ action: "sound_effect" }).ok, false);
});

test("REQ-148: action defaults to speak, model defaults to elevenlabs/flash-v2.5, response_format to mp3", () => {
  const r = buildRequest({ input: "hi" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.action, "speak");
    assert.equal(r.value.model, "elevenlabs/flash-v2.5");
    assert.equal(r.value.responseFormat, "mp3");
  }
});
