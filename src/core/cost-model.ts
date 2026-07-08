// REQ-DX-003, REQ-DX-NG-004. `costModel` ("free"|"paid") is derived by inspecting
// whether each command's REAL src/commands/<name>.ts source calls `gatePaidCall` —
// the SAME ground truth REQ-DX-001 grep-verified (`grep -c gatePaidCall
// src/commands/*.ts` → 0 for wallet/models/dex, 2 for the other 15) — never a
// hand-typed, independently-maintained list that could silently drift from the real
// source. Resolved relative to THIS module's own location so it works both under tsx
// (src/core/cost-model.ts, sibling of src/commands/) and from the built single-file
// dist/index.js bundle (dist/ and src/ are siblings under the repo root — the same
// repo-relative assumption every Tier 2 CLI test in this repo already makes).
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type CostModel = "free" | "paid";

function findCommandsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "commands"), // dev: src/core -> src/commands
    path.join(here, "..", "src", "commands"), // built: dist -> src/commands
  ];
  for (const dir of candidates) {
    try {
      if (readdirSync(dir).some((f) => f.endsWith(".ts"))) return dir;
    } catch {
      /* try next candidate */
    }
  }
  throw new Error(`cost-model: could not locate src/commands/ from ${here}`);
}

function deriveCostModel(): Record<string, CostModel> {
  const dir = findCommandsDir();
  const registry: Record<string, CostModel> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts") || file === "shared.ts") continue;
    const name = file.replace(/\.ts$/, "");
    const src = readFileSync(path.join(dir, file), "utf8");
    registry[name] = src.includes("gatePaidCall(") ? "paid" : "free";
  }
  return registry;
}

export const COMMAND_COST_MODEL: Record<string, CostModel> = deriveCostModel();
