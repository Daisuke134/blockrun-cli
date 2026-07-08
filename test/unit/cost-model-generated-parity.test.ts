// Run with: npm test (tsx --test)
// PROP-PACK-001/002 (REQ-PACK-001, -002, -005). `src/core/cost-model.generated.ts` does
// not exist yet (Red phase) — this whole file fails on import until Phase 2b's
// scripts/generate-cost-model.mjs is run to create it and cost-model.ts is rewritten
// to re-export from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const COMMANDS_DIR = fileURLToPath(new URL("../../src/commands/", import.meta.url));

const KNOWN_CORRECT = {
  wallet: "free", models: "free", dex: "free",
  chat: "paid", image: "paid", video: "paid", realface: "paid", music: "paid",
  speech: "paid", search: "paid", exa: "paid", markets: "paid", price: "paid",
  rpc: "paid", defi: "paid", modal: "paid", phone: "paid", surf: "paid",
} as const;

test("PROP-PACK-001: cost-model.ts's COMMAND_COST_MODEL re-exports cost-model.generated.ts's (REQ-PACK-NG-001: values unchanged, 18 commands, wallet/models/dex free, other 15 paid)", async () => {
  const costModel = await import("../../src/core/cost-model.js");
  const generated = await import("../../src/core/cost-model.generated.js");
  assert.deepEqual(costModel.COMMAND_COST_MODEL, generated.COMMAND_COST_MODEL);
  assert.deepEqual(costModel.COMMAND_COST_MODEL, KNOWN_CORRECT);
});

test("PROP-PACK-002/REQ-PACK-005: cost-model.generated.ts has NO drift from a FRESH re-derivation of the real src/commands/*.ts gatePaidCall( grep", async () => {
  const freshlyDerived: Record<string, string> = {};
  for (const file of readdirSync(COMMANDS_DIR)) {
    if (!file.endsWith(".ts") || file === "shared.ts") continue;
    const name = file.replace(/\.ts$/, "");
    const src = readFileSync(`${COMMANDS_DIR}${file}`, "utf8");
    freshlyDerived[name] = src.includes("gatePaidCall(") ? "paid" : "free";
  }
  const generated = await import("../../src/core/cost-model.generated.js");
  assert.deepEqual(generated.COMMAND_COST_MODEL, freshlyDerived, "cost-model.generated.ts is stale relative to the real src/commands/*.ts source — re-run scripts/generate-cost-model.mjs");
});

test("PROP-PACK-001: cost-model.generated.ts's derivation contains NO runtime filesystem access (readFileSync/readdirSync/import.meta.url) — REQ-PACK-001's 'zero runtime fs access' requirement", async () => {
  const generatedPath = fileURLToPath(new URL("../../src/core/cost-model.generated.ts", import.meta.url));
  const src = readFileSync(generatedPath, "utf8");
  assert.ok(!/readFileSync|readdirSync|import\.meta\.url/.test(src), "the generated file must be a plain object literal with no runtime fs/path resolution");
});
