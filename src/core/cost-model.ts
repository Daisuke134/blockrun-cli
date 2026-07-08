// REQ-DX-003, REQ-DX-NG-004, REQ-PACK-001/002 (blockrun-cli-pack-fix HOTFIX). `costModel`
// ("free"|"paid") is derived from whether each command's REAL src/commands/<name>.ts
// source calls `gatePaidCall` — the SAME ground truth REQ-DX-001 grep-verified. This
// module is a THIN RE-EXPORT of the BUILD-TIME-GENERATED cost-model.generated.ts
// (produced by scripts/generate-cost-model.mjs, auto-run via package.json's
// "prebuild" script). Previously this module read src/commands/*.ts from disk at
// RUNTIME (import.meta.url-relative path resolution) — that broke every
// npm-installed copy of this package, since an installed package never ships src/
// (package.json's "files": ["dist","README.md"]), causing an unconditional crash at
// module-load time for every command (confirmed live, reproduced independently via a
// real `npm pack` + tar extract — REQ-PACK-006). The generated file has ZERO runtime
// filesystem access, so the built dist/index.js never needs src/ again.
export { COMMAND_COST_MODEL, type CostModel } from "./cost-model.generated.js";
