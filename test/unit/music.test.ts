// Run with: npm test (tsx --test)
// PROP-119 (REQ-144–147). No variable cost estimator (music is a flat $0.1575) — the
// only pure-core logic worth unit testing is the instrumental/lyrics mutual exclusion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, MUSIC_COST } from "../../src/args/music.js";

test("REQ-145: lyrics is rejected when instrumental is true (including the default)", () => {
  assert.equal(buildRequest({ prompt: "p", lyrics: "la la la" }).ok, false, "instrumental defaults true");
  assert.equal(buildRequest({ prompt: "p", instrumental: true, lyrics: "la la la" }).ok, false);
});

test("REQ-145: lyrics is accepted when instrumental is explicitly false", () => {
  const r = buildRequest({ prompt: "p", instrumental: false, lyrics: "la la la" });
  assert.equal(r.ok, true);
});

test("REQ-144: instrumental defaults to true, model defaults to minimax/music-2.5+", () => {
  const r = buildRequest({ prompt: "p" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.instrumental, true);
    assert.equal(r.value.model, "minimax/music-2.5+");
  }
});

test("REQ-147: MUSIC_COST is the flat estimate used before the real 402 quote is known", () => {
  assert.equal(MUSIC_COST, 0.1575);
});

test("an empty/whitespace lyrics string with instrumental:true is not treated as 'lyrics provided'", () => {
  const r = buildRequest({ prompt: "p", instrumental: true, lyrics: "   " });
  assert.equal(r.ok, true, "mirrors music.ts's lyrics?.trim() check");
});

test("REQ-144a: a bare positional argument compiles into --prompt, identical to the canonical form", () => {
  const viaPositional = buildRequest({ $positional: ["chill lo-fi beats"] });
  const viaCanonical = buildRequest({ prompt: "chill lo-fi beats" });
  assert.equal(viaPositional.ok, true);
  assert.equal(viaCanonical.ok, true);
  if (viaPositional.ok && viaCanonical.ok) assert.deepEqual(viaPositional.value, viaCanonical.value);
});

test("REQ-144a: supplying BOTH the positional and --prompt is a conflict error", () => {
  const r = buildRequest({ $positional: ["beat a"], prompt: "beat b" });
  assert.equal(r.ok, false);
});
