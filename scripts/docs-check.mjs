#!/usr/bin/env node
// Tier-1 mechanical docs-check for the `blockrun-cli-docs` feature.
//
// Implements every Tier-1 PROP from
// .vcsdd/features/blockrun-cli-docs/specs/verification-architecture.md:
//   PROP-001 002 003 006 007 008 009 010 011 012 013 015 016 016b 017 022 024 025
// (PROP-022 — the 3-document cross-check between PARITY.md/VERIFICATION.md/
//  evidence/*.json — was added in Phase 3/4; it is Tier 1 per the spec but was
//  missing from this script's Phase 2a implementation, an oversight.)
// (PROP-016b — line-level check that the ONE narrow src/ exception,
//  DOC-CONSTRAINT-001a's `.version("...")` release literal in src/index.ts, is
//  the ONLY change under src/ — added Phase 3/4 alongside the actual fix.)
// (PROP-004/005/023 are Tier 2 — live execution — and are NOT run by this script;
//  PROP-014/018/019/020/021 are Tier 2/3 and likewise out of scope here.)
//
// Pure/offline: no network access, no spend. Reads repo files + runs local
// `git`/`node dist/index.js --help` (already-built binary, no network call).
//
// Usage: node scripts/docs-check.mjs
// Exit code = number of FAILing PROPs (0 = all pass).
//
// PARITY.md format CONTRACT this script assumes (not mandated by the spec's
// prose, but required for this script to parse it — Phase 2b MUST follow it):
//   One `### <command>` heading per command (18 total, lowercase command name,
//   e.g. `### wallet`). Each command's section (until the next `### `/`## `
//   heading or EOF) MUST mention:
//     - the MCP tool name `blockrun_<command>`
//     - the CLI form `blockrun <command>`
//     - a tier tag: the literal string `DUAL-LIVE-RUN` or `SCHEMA-ONLY`
//     - for SCHEMA-ONLY commands: every MCP-declared top-level parameter name
//       (see SCHEMA_ONLY_MCP_PARAMS below) as a case/format-insensitive
//       substring (kebab/camel/snake all normalize to lowercase-alnum-only).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REF_MCP_ROOT =
  "/private/tmp/claude-501/-Users-anicca-anicca-project/ec3606df-8de7-491a-8a92-7ee667020d6a/scratchpad/blockrun-mcp";

const FEATURE_NAME = "blockrun-cli-docs";

/** @type {{id: string, ok: boolean, detail: string}[]} */
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
}

function readFileOpt(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function repoPath(...parts) {
  return path.join(REPO_ROOT, ...parts);
}

// ---------------------------------------------------------------------------
// Shared ground truth: the 18 real subcommand names, from the ALREADY-BUILT
// `dist/index.js --help` output (no network — this is a local process spawn).
// ---------------------------------------------------------------------------

function getRealCommandNames() {
  const distPath = repoPath("dist/index.js");
  if (!fs.existsSync(distPath)) {
    throw new Error(`dist/index.js not found at ${distPath} — run 'npm run build' first.`);
  }
  const help = execFileSync("node", [distPath, "--help"], { encoding: "utf-8" });
  const lines = help.split("\n");
  const names = [];
  let inCommands = false;
  for (const line of lines) {
    if (/^Commands:/.test(line.trim())) {
      inCommands = true;
      continue;
    }
    if (!inCommands) continue;
    const m = line.match(/^\s{2}([a-z]+)\s/);
    if (m && m[1] !== "help") names.push(m[1]);
  }
  return names;
}

const DUAL_LIVE_RUN_COMMANDS = ["wallet", "chat", "models", "dex", "price", "defi", "markets", "rpc", "phone"];
const SCHEMA_ONLY_COMMANDS = ["image", "video", "music", "realface", "modal", "speech", "search", "exa", "surf"];

// MCP-declared top-level parameter names for the 9 SCHEMA-ONLY commands —
// captured verbatim from this session's connected `mcp__blockrun__blockrun_*`
// tool definitions (ToolSearch select:..., 2026-07-08). Static snapshot, since
// this script runs fully offline and cannot call MCP tools itself.
const SCHEMA_ONLY_MCP_PARAMS = {
  image: ["action", "agent_id", "image", "inline", "mask", "model", "prompt", "quality", "size"],
  video: [
    "agent_id",
    "aspect_ratio",
    "duration_seconds",
    "generate_audio",
    "image_url",
    "last_frame_url",
    "model",
    "prompt",
    "real_face_asset_id",
    "resolution",
  ],
  music: ["agent_id", "instrumental", "lyrics", "model", "prompt"],
  realface: ["action", "agent_id", "group_id", "image_url", "name"],
  modal: ["agent_id", "body", "path"],
  speech: [
    "action",
    "agent_id",
    "duration_seconds",
    "input",
    "model",
    "prompt_influence",
    "response_format",
    "speed",
    "voice",
  ],
  search: ["agent_id", "body", "path"],
  exa: ["agent_id", "body", "path"],
  surf: ["agent_id", "body", "params", "path"],
};

// CLI's own real zod-schema field names for the 9 SCHEMA-ONLY commands, read
// directly from src/args/<command>.ts (2026-07-08). Read-only reference —
// this script never writes under src/.
const SCHEMA_ONLY_CLI_PARAMS = {
  image: ["prompt", "action", "model", "image", "mask", "size", "quality", "inline", "agent_id"],
  video: [
    "prompt",
    "image_url",
    "real_face_asset_id",
    "duration_seconds",
    "generate_audio",
    "resolution",
    "aspect_ratio",
    "last_frame_url",
    "model",
    "agent_id",
  ],
  music: ["prompt", "instrumental", "lyrics", "model", "agent_id"],
  realface: ["action", "name", "group_id", "image_url", "agent_id"],
  modal: ["path", "body", "agent_id"],
  speech: ["action", "input", "voice", "model", "response_format", "speed", "duration_seconds", "prompt_influence", "agent_id"],
  search: ["path", "body", "agent_id", "query", "sources", "max_results", "from_date", "to_date"],
  exa: ["path", "body", "agent_id"],
  surf: ["path", "params", "body", "agent_id"],
};

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// PROP-001 — README.md heading order
// ---------------------------------------------------------------------------

function checkProp001() {
  const readme = readFileOpt(repoPath("README.md"));
  if (readme === null) {
    record("PROP-001", false, "README.md does not exist");
    return;
  }
  const headings = readme
    .split("\n")
    .filter((l) => /^##\s/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim());

  const anchors = [
    { name: "Prerequisites", re: /^Prerequisites/i },
    { name: "Install", re: /^Install/i },
    { name: "Fund your wallet", re: /^Fund your wallet/i },
    { name: "Commands", re: /^Commands/i },
    { name: "Multi-agent budget delegation", re: /^Multi-agent budget delegation/i },
    { name: "Troubleshooting", re: /^Troubleshooting/i },
    { name: "Environment Variables", re: /^Environment Variables/i },
    { name: "How it works", re: /^How it works/i },
    { name: "Contributing", re: /^Contributing/i },
    { name: "License", re: /^License/i },
  ];

  const indices = anchors.map((a) => ({
    name: a.name,
    idx: headings.findIndex((h) => a.re.test(h)),
  }));

  const missing = indices.filter((i) => i.idx === -1).map((i) => i.name);
  if (missing.length > 0) {
    record("PROP-001", false, `missing required heading(s): ${missing.join(", ")}`);
    return;
  }

  for (let i = 1; i < indices.length; i++) {
    if (indices[i].idx <= indices[i - 1].idx) {
      record(
        "PROP-001",
        false,
        `heading order violation: "${indices[i - 1].name}" (pos ${indices[i - 1].idx}) must come before "${indices[i].name}" (pos ${indices[i].idx})`,
      );
      return;
    }
  }
  record("PROP-001", true, "heading order matches required sequence");
}

// ---------------------------------------------------------------------------
// PROP-002 — README Commands table: exactly 18 rows, matching real command set
// ---------------------------------------------------------------------------

function extractSection(markdown, headingRe) {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => /^##\s/.test(l) && headingRe.test(l.replace(/^##\s+/, "")));
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx + 1, endIdx).join("\n");
}

function parseMarkdownTableRows(sectionText) {
  const lines = sectionText.split("\n").filter((l) => /^\s*\|/.test(l));
  // Drop header row + separator row (---|---)
  const dataRows = lines.filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l));
  return dataRows.slice(1); // first remaining row is the header text row itself
}

function checkProp002(realNames) {
  const readme = readFileOpt(repoPath("README.md"));
  if (readme === null) {
    record("PROP-002", false, "README.md does not exist");
    return;
  }
  const section = extractSection(readme, /^Commands/i);
  if (section === null) {
    record("PROP-002", false, "## Commands section not found");
    return;
  }
  const rows = parseMarkdownTableRows(section);
  const foundNames = new Set();
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim());
    const firstCell = cells.find((c) => c.length > 0) ?? "";
    const m = firstCell.match(/blockrun\s+([a-z]+)/) || firstCell.match(/`([a-z]+)`/) || firstCell.match(/^([a-z]+)$/);
    if (m) foundNames.add(m[1]);
  }
  const realSet = new Set(realNames);
  const missing = [...realSet].filter((n) => !foundNames.has(n));
  const extra = [...foundNames].filter((n) => !realSet.has(n));
  // 19 as of blockrun-cli-agent-dx REQ-DX-030: the README Commands table gains a row
  // for the new `commands` subcommand itself, alongside the 18 original rows.
  if (rows.length !== 19 || missing.length > 0 || extra.length > 0) {
    record(
      "PROP-002",
      false,
      `expected 19 rows matching {${[...realSet].join(",")}}; got ${rows.length} rows, parsed names {${[...foundNames].join(",")}}` +
        (missing.length ? `; missing: ${missing.join(",")}` : "") +
        (extra.length ? `; extra: ${extra.join(",")}` : ""),
    );
    return;
  }
  record("PROP-002", true, "19/19 command rows present and match real subcommand set");
}

// ---------------------------------------------------------------------------
// PROP-003 — README forbidden terms
// ---------------------------------------------------------------------------

const FORBIDDEN_TERMS = [
  "model-context-protocol",
  "claude mcp add",
  "tool profiles",
  "spawn npx enoent",
  "coming soon",
  "tbd",
  "planned",
];

function checkForbiddenTerms(id, text, label) {
  if (text === null) {
    record(id, false, `${label} does not exist`);
    return;
  }
  const lower = text.toLowerCase();
  const hits = FORBIDDEN_TERMS.filter((t) => lower.includes(t));
  if (hits.length > 0) {
    record(id, false, `${label} contains forbidden term(s): ${hits.join(", ")}`);
    return;
  }
  record(id, true, `${label} free of forbidden placeholder/MCP-framing terms`);
}

function checkProp003() {
  checkForbiddenTerms("PROP-003", readFileOpt(repoPath("README.md")), "README.md");
}

// ---------------------------------------------------------------------------
// PROP-006 — README Environment Variables table: exactly 6 rows, exact set
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = [
  "BLOCKRUN_BUDGET_LIMIT",
  "~/.blockrun/.session",
  "~/.blockrun/.chain",
  "~/.blockrun/payment-chain",
  "~/.blockrun/.solana-session",
  "SOLANA_WALLET_KEY",
];

function checkProp006() {
  const readme = readFileOpt(repoPath("README.md"));
  if (readme === null) {
    record("PROP-006", false, "README.md does not exist");
    return;
  }
  if (/BLOCKRUN_API_BASE_URL/.test(readme) || /BLOCKRUN_HOME/.test(readme)) {
    record("PROP-006", false, "README.md contains excluded var (BLOCKRUN_API_BASE_URL or BLOCKRUN_HOME)");
    return;
  }
  const section = extractSection(readme, /^Environment Variables/i);
  if (section === null) {
    record("PROP-006", false, "## Environment Variables section not found");
    return;
  }
  const rows = parseMarkdownTableRows(section);
  if (rows.length !== 6) {
    record("PROP-006", false, `expected exactly 6 data rows, got ${rows.length}`);
    return;
  }
  const rowText = rows.join(" ");
  const missing = REQUIRED_ENV_VARS.filter((v) => !rowText.includes(v));
  if (missing.length > 0) {
    record("PROP-006", false, `missing required member(s) in table: ${missing.join(", ")}`);
    return;
  }
  // .chain and payment-chain must each have their OWN row (not combined via '/')
  const chainRow = rows.find((r) => r.includes("~/.blockrun/.chain"));
  const paymentChainRow = rows.find((r) => r.includes("~/.blockrun/payment-chain"));
  if (chainRow && paymentChainRow && chainRow === paymentChainRow) {
    record("PROP-006", false, "'.chain' and 'payment-chain' are combined into a single row — must be separate rows");
    return;
  }
  record("PROP-006", true, "Environment Variables table has exactly 6 rows with the required member set, .chain/payment-chain separate");
}

// ---------------------------------------------------------------------------
// PROP-007 — CHANGELOG.md format
// ---------------------------------------------------------------------------

function checkProp007() {
  const changelog = readFileOpt(repoPath("CHANGELOG.md"));
  if (changelog === null) {
    record("PROP-007", false, "CHANGELOG.md does not exist");
    return;
  }
  const lines = changelog.split("\n");
  // The real blockrun-mcp/CHANGELOG.md reference structure is: `# Changelog` (H1) on the
  // first non-blank line, then the preamble sentence on the NEXT non-blank line — not
  // literally line 1. Check the first few non-blank lines (H1 title + preamble), not just
  // the very first one.
  const nonBlankLines = lines.filter((l) => l.trim().length > 0).slice(0, 3);
  const preambleOk = nonBlankLines.some((l) =>
    /all notable changes to .+ will be documented in this file\.?/i.test(l),
  );
  if (!preambleOk) {
    record("PROP-007", false, `no preamble line found in the first 3 non-blank lines: ${JSON.stringify(nonBlankLines)}`);
    return;
  }
  const versionHeadings = lines.filter((l) => /^##\s+\d/.test(l));
  const exactOneZeroHeadings = lines.filter((l) => /^##\s+1\.0\.0\s*$/.test(l));
  if (exactOneZeroHeadings.length !== 1) {
    record("PROP-007", false, `expected exactly one '## 1.0.0' heading, found ${exactOneZeroHeadings.length}`);
    return;
  }
  const otherHeadings = versionHeadings.filter((l) => !/^##\s+1\.0\.0\s*$/.test(l));
  if (otherHeadings.length > 0) {
    let tags = "";
    try {
      tags = execFileSync("git", ["log", "--tags", "--format=%D"], { cwd: REPO_ROOT, encoding: "utf-8" });
    } catch {
      tags = "";
    }
    if (!tags.includes("tag:")) {
      record("PROP-007", false, `unexpected version heading(s) with no matching git tag: ${otherHeadings.join(", ")}`);
      return;
    }
  }
  // Bullets under ## 1.0.0
  const startIdx = lines.findIndex((l) => /^##\s+1\.0\.0\s*$/.test(l));
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const bullets = lines.slice(startIdx + 1, endIdx).filter((l) => /^-\s/.test(l.trim()));
  if (bullets.length === 0) {
    record("PROP-007", false, "'## 1.0.0' section has no bullet entries");
    return;
  }
  const badBullets = bullets.filter((b) => !/^-\s+\*\*.+—.+\.\*\*/.test(b.trim()));
  if (badBullets.length > 0) {
    record("PROP-007", false, `bullet(s) not matching '- **area — headline.**' format: ${badBullets.length} of ${bullets.length}`);
    return;
  }
  record("PROP-007", true, "CHANGELOG.md preamble/1.0.0-heading/bullet-format all correct");
}

// ---------------------------------------------------------------------------
// PROP-008 — CONTRIBUTING.md scripts + skill-ban
// ---------------------------------------------------------------------------

function checkProp008() {
  const contrib = readFileOpt(repoPath("CONTRIBUTING.md"));
  if (contrib === null) {
    record("PROP-008", false, "CONTRIBUTING.md does not exist");
    return;
  }
  const pkgRaw = readFileOpt(repoPath("package.json"));
  const pkg = pkgRaw ? JSON.parse(pkgRaw) : { scripts: {} };
  const scripts = pkg.scripts ?? {};
  // DOC-CONTRIB-002 names a FIXED subset of scripts the Setup section must document
  // (npm install, typecheck, build, dev, test, test:e2e) — NOT every key in
  // package.json's scripts object (e.g. "start" is a runtime launcher, not part of
  // the contributor setup workflow, and is intentionally not required here).
  const SPEC_REQUIRED_SCRIPT_KEYS = ["typecheck", "build", "dev", "test", "test:e2e"];
  const requiredSubstrings = ["npm install"];
  for (const key of SPEC_REQUIRED_SCRIPT_KEYS) {
    if (!(key in scripts)) continue; // only require scripts that actually exist
    if (key === "test") requiredSubstrings.push("npm test");
    else requiredSubstrings.push(`npm run ${key}`);
  }
  const missingScripts = requiredSubstrings.filter((s) => !contrib.includes(s));
  if (missingScripts.length > 0) {
    record("PROP-008", false, `missing required script invocation(s): ${missingScripts.join(", ")}`);
    return;
  }
  const lowerContrib = contrib.toLowerCase();
  const structuralBans = [];
  if (/skills\/[^\s`]+\//i.test(contrib)) structuralBans.push("skills/<name>/ path pattern");
  if (lowerContrib.includes("skill.md")) structuralBans.push("SKILL.md");
  if (/\b(add|create)\s+(a\s+)?new\s+skill\b/i.test(contrib) || /\b(add|create)\s+a\s+skill\b/i.test(contrib)) {
    structuralBans.push('imperative "add/create a (new) skill"');
  }
  if (structuralBans.length > 0) {
    record("PROP-008", false, `contains banned structural skill-mechanism claim(s): ${structuralBans.join(", ")}`);
    return;
  }
  record("PROP-008", true, "CONTRIBUTING.md has all required script invocations, no banned skill-mechanism claims");
}

// ---------------------------------------------------------------------------
// PROP-009 — CONTRIBUTING.md PR checklist: 6 items
// ---------------------------------------------------------------------------

function checkProp009() {
  const contrib = readFileOpt(repoPath("CONTRIBUTING.md"));
  if (contrib === null) {
    record("PROP-009", false, "CONTRIBUTING.md does not exist");
    return;
  }
  const lower = contrib.toLowerCase();
  const required = [
    { label: "typecheck", re: /typecheck/ },
    { label: "build", re: /\bbuild\b/ },
    { label: "test", re: /\btest\b/ },
    { label: "README Commands table", re: /commands table/ },
    { label: "CHANGELOG entry", re: /changelog/ },
    { label: "version bump", re: /version.*bump|bump.*version/ },
  ];
  const missing = required.filter((r) => !r.re.test(lower)).map((r) => r.label);
  if (missing.length > 0) {
    record("PROP-009", false, `PR checklist missing item(s): ${missing.join(", ")}`);
    return;
  }
  record("PROP-009", true, "PR checklist contains all 6 required items");
}

// ---------------------------------------------------------------------------
// PROP-010 — LICENSE body vs blockrun-mcp/LICENSE, + package.json license
// ---------------------------------------------------------------------------

function stripCopyrightLine(text) {
  return text
    .split("\n")
    .filter((l) => !/^Copyright \(c\)/i.test(l.trim()))
    .join("\n")
    .trim();
}

function checkProp010() {
  const license = readFileOpt(repoPath("LICENSE"));
  if (license === null) {
    record("PROP-010", false, "LICENSE does not exist");
    return;
  }
  const refLicense = readFileOpt(path.join(REF_MCP_ROOT, "LICENSE"));
  if (refLicense === null) {
    record("PROP-010", false, `reference blockrun-mcp/LICENSE not found at ${REF_MCP_ROOT}`);
    return;
  }
  const a = stripCopyrightLine(license);
  const b = stripCopyrightLine(refLicense);
  if (a !== b) {
    record("PROP-010", false, "LICENSE body (minus copyright line) differs from blockrun-mcp/LICENSE");
    return;
  }
  const pkgRaw = readFileOpt(repoPath("package.json"));
  if (pkgRaw === null) {
    record("PROP-010", false, "package.json does not exist");
    return;
  }
  const pkg = JSON.parse(pkgRaw);
  if (pkg.license !== "MIT") {
    record("PROP-010", false, `package.json.license !== "MIT" (got: ${JSON.stringify(pkg.license)})`);
    return;
  }
  record("PROP-010", true, "LICENSE body matches blockrun-mcp/LICENSE; package.json.license === MIT");
}

// ---------------------------------------------------------------------------
// PROP-011 — package.json field checks
// ---------------------------------------------------------------------------

function checkProp011() {
  const pkgRaw = readFileOpt(repoPath("package.json"));
  if (pkgRaw === null) {
    record("PROP-011", false, "package.json does not exist");
    return;
  }
  let pkg;
  try {
    pkg = JSON.parse(pkgRaw);
  } catch (e) {
    record("PROP-011", false, `package.json is not valid JSON: ${e.message}`);
    return;
  }
  const failures = [];

  if (typeof pkg.description !== "string" || pkg.description.trim().length === 0) {
    failures.push("description is empty/missing");
  } else if (/\bMCP\b/i.test(pkg.description) || /model context protocol/i.test(pkg.description)) {
    failures.push("description claims MCP-server framing");
  }

  const keywords = Array.isArray(pkg.keywords) ? pkg.keywords : [];
  const requiredKeywords = ["cli", "blockrun", "x402", "micropayments", "ai"];
  const missingKeywords = requiredKeywords.filter((k) => !keywords.includes(k));
  const forbiddenKeywords = ["mcp", "model-context-protocol", "claude"];
  const presentForbidden = forbiddenKeywords.filter((k) => keywords.includes(k));
  if (missingKeywords.length > 0) failures.push(`keywords missing: ${missingKeywords.join(",")}`);
  if (presentForbidden.length > 0) failures.push(`keywords contains forbidden: ${presentForbidden.join(",")}`);

  const repoUrl = pkg.repository?.url ?? "";
  if (!/^(git\+)?https:\/\/github\.com\/Daisuke134\/blockrun-cli(\.git)?$/.test(repoUrl)) {
    failures.push(`repository.url invalid: ${JSON.stringify(repoUrl)}`);
  }

  if (typeof pkg.homepage !== "string" || !pkg.homepage.startsWith("https://github.com/Daisuke134/blockrun-cli")) {
    failures.push(`homepage invalid: ${JSON.stringify(pkg.homepage)}`);
  }

  if (JSON.stringify(pkg.bin) !== JSON.stringify({ blockrun: "./dist/index.js" })) {
    failures.push(`bin field changed from required {"blockrun":"./dist/index.js"}: ${JSON.stringify(pkg.bin)}`);
  }

  // 1.2.1 as of the pack-fix HOTFIX (blockrun-cli-pack-fix REQ-PACK-001..008): a
  // packaging-only patch bump — moves COMMAND_COST_MODEL derivation from a runtime
  // src/ filesystem scan (broken for every npm-installed copy) to a build-time
  // generated, bundled table. No behavior/API change.
  if (pkg.version !== "1.2.1") {
    failures.push(`version !== "1.2.1" (got: ${JSON.stringify(pkg.version)})`);
  }

  if (pkg.bugs?.url !== "https://github.com/Daisuke134/blockrun-cli/issues") {
    failures.push(`bugs.url invalid: ${JSON.stringify(pkg.bugs?.url)}`);
  }

  if (failures.length > 0) {
    record("PROP-011", false, failures.join("; "));
    return;
  }
  record("PROP-011", true, "all package.json fields correct");
}

// ---------------------------------------------------------------------------
// PARITY.md section parsing (shared by PROP-012/013/024/025)
// ---------------------------------------------------------------------------

function parsePARITYSections(parityText) {
  const lines = parityText.split("\n");
  const sections = {};
  let current = null;
  let buf = [];
  for (const line of lines) {
    const m = line.match(/^###\s+([a-z]+)\s*$/);
    if (m) {
      if (current) sections[current] = buf.join("\n");
      current = m[1];
      buf = [];
      continue;
    }
    if (/^##\s/.test(line) && current) {
      sections[current] = buf.join("\n");
      current = null;
      buf = [];
      continue;
    }
    if (current) buf.push(line);
  }
  if (current) sections[current] = buf.join("\n");
  return sections;
}

// ---------------------------------------------------------------------------
// PROP-012 — PARITY.md exists, 18 sections naming MCP tool + CLI form
// ---------------------------------------------------------------------------

function checkProp012(realNames) {
  const parity = readFileOpt(repoPath("PARITY.md"));
  if (parity === null) {
    record("PROP-012", false, "PARITY.md does not exist");
    return;
  }
  const sections = parsePARITYSections(parity);
  // blockrun-cli-agent-dx REQ-DX-033/034: `commands` is deliberately EXCLUDED from
  // this per-command MCP-parity check — it has no `blockrun-mcp` tool equivalent
  // (MCP's own protocol already provides tools/list), so PARITY.md documents it as a
  // single "Known non-parity points" bullet instead of a `### commands` section. The
  // 18 ORIGINAL commands still each need their own section, unchanged.
  const parityEligibleNames = realNames.filter((n) => n !== "commands");
  const realSet = new Set(parityEligibleNames);
  const foundSet = new Set(Object.keys(sections));
  const missing = [...realSet].filter((n) => !foundSet.has(n));
  const extra = [...foundSet].filter((n) => !realSet.has(n));
  if (missing.length > 0 || extra.length > 0 || Object.keys(sections).length !== 18) {
    record(
      "PROP-012",
      false,
      `expected 18 '### <command>' sections matching real command set; got ${Object.keys(sections).length}` +
        (missing.length ? `; missing: ${missing.join(",")}` : "") +
        (extra.length ? `; extra: ${extra.join(",")}` : ""),
    );
    return;
  }
  const badNaming = [];
  for (const name of parityEligibleNames) {
    const body = sections[name] ?? "";
    if (!body.includes(`blockrun_${name}`)) badNaming.push(`${name}: missing blockrun_${name}`);
    if (!new RegExp(`blockrun\\s+${name}\\b`).test(body)) badNaming.push(`${name}: missing 'blockrun ${name}'`);
  }
  if (badNaming.length > 0) {
    record("PROP-012", false, `section(s) missing MCP-tool/CLI-form naming: ${badNaming.join("; ")}`);
    return;
  }
  record("PROP-012", true, "PARITY.md has 18/18 sections, each naming both MCP tool and CLI form");
}

// ---------------------------------------------------------------------------
// PROP-013 — PARITY.md non-parity call-outs
// ---------------------------------------------------------------------------

function checkProp013() {
  const parity = readFileOpt(repoPath("PARITY.md"));
  if (parity === null) {
    record("PROP-013", false, "PARITY.md does not exist");
    return;
  }
  const required = ["--budget-limit", "--max-quote-usd", "profile"];
  const lower = parity.toLowerCase();
  const missing = required.filter((s) => !lower.includes(s.toLowerCase()));
  if (missing.length > 0) {
    record("PROP-013", false, `missing intentional-non-parity call-out(s): ${missing.join(", ")}`);
    return;
  }
  record("PROP-013", true, "all 3 known intentional non-parity points called out");
}

// ---------------------------------------------------------------------------
// PROP-015 — execution-notes.md mentions feature + today's date
// ---------------------------------------------------------------------------

function checkProp015() {
  const notes = readFileOpt(repoPath("execution-notes.md"));
  if (notes === null) {
    record("PROP-015", false, "execution-notes.md does not exist");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const hasFeature = notes.includes(FEATURE_NAME);
  const hasToday = notes.includes(today);
  if (!hasFeature || !hasToday) {
    record(
      "PROP-015",
      false,
      `execution-notes.md missing ${!hasFeature ? `feature name '${FEATURE_NAME}'` : ""}${!hasFeature && !hasToday ? " and " : ""}${!hasToday ? `today's date '${today}'` : ""}`,
    );
    return;
  }
  record("PROP-015", true, `execution-notes.md references '${FEATURE_NAME}' and today's date ${today}`);
}

// ---------------------------------------------------------------------------
// PROP-016 — git diff allow-list since feature-init commit
// ---------------------------------------------------------------------------

// Widened from `.vcsdd/features/blockrun-cli-docs/` to all of `.vcsdd/**`
// per Dais's direct instruction during Phase 2b: the VCSDD orchestrator
// writes shared, repo-wide state-machine bookkeeping (active-feature.txt,
// history.jsonl, index.json) OUTSIDE this feature's own directory as an
// unavoidable side effect of running ANY vcsdd command. PROP-016's real
// protective intent is src/test/dist-untouched (REQ-NG-001), enforced by
// the separate srcTouched check below, not literal isolation from the
// orchestrator's cross-feature state. See verification-architecture.md
// PROP-016 for the full rationale.
const ALLOWED_PATH_PATTERNS = [
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^CONTRIBUTING\.md$/,
  /^LICENSE$/,
  /^package\.json$/,
  /^PARITY\.md$/,
  /^VERIFICATION\.md$/,
  /^execution-notes\.md$/,
  /^scripts\/docs-check\..+$/,
  /^\.vcsdd\//,
  // DOC-CONSTRAINT-001a's narrow exception (added Phase 3/4): src/index.ts MAY
  // appear here at the FILE level; the stricter LINE-level check (that only the
  // .version("...") literal changed, nothing else in the file) is PROP-016b.
  /^src\/index\.ts$/,
];

// FROZEN HISTORICAL RANGE (per Dais/team-lead, 2026-07-08): PROP-016/PROP-016b are a
// completed, permanent verification of the blockrun-cli-docs feature ONLY — that it
// touched nothing but docs/meta files (plus DOC-CONSTRAINT-001a's one-line src/index.ts
// exception) between its own init and its own converge-complete commit. The range is
// PINNED to those two commits, not "since init through whatever HEAD is today" — a
// later, legitimate src/ feature (e.g. blockrun-cli-agent-dx) landing real changes on
// top of this completed range must NOT flip these two checks to FAIL. Do not widen this
// range to track HEAD again; that reintroduces the exact false-fail this fix closes.
const DOCS_FEATURE_START_COMMIT = "eadc61c"; // vcsdd(docs): init blockrun-cli-docs feature (lean)
const DOCS_FEATURE_END_COMMIT = "a38b32a"; // vcsdd(docs): converge PASS — feature complete

function checkProp016() {
  let changedFiles;
  try {
    // Two FIXED refs (not a ref-vs-working-tree diff): this is a frozen, one-time-true
    // historical fact about the completed blockrun-cli-docs feature, not an ongoing
    // gate against the current working tree/HEAD.
    const out = execFileSync(
      "git",
      ["diff", "--name-only", `${DOCS_FEATURE_START_COMMIT}~1`, DOCS_FEATURE_END_COMMIT],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    ).trim();
    changedFiles = out.length > 0 ? out.split("\n") : [];
  } catch (e) {
    record("PROP-016", false, `git diff failed: ${e.message}`);
    return;
  }
  const disallowed = changedFiles.filter((f) => !ALLOWED_PATH_PATTERNS.some((re) => re.test(f)));
  const testDistTouched = changedFiles.filter((f) => /^(test|dist)\//.test(f));
  const srcTouched = changedFiles.filter((f) => /^src\//.test(f));
  // DOC-CONSTRAINT-001a's narrow exception: src/index.ts MAY change (one line only,
  // checked at line-granularity by PROP-016b below) — no OTHER file under src/ may.
  const srcTouchedOutsideException = srcTouched.filter((f) => f !== "src/index.ts");
  if (disallowed.length > 0) {
    record("PROP-016", false, `path(s) outside allow-list: ${disallowed.join(", ")}`);
    return;
  }
  if (testDistTouched.length > 0) {
    record("PROP-016", false, `test/dist touched (forbidden): ${testDistTouched.join(", ")}`);
    return;
  }
  if (srcTouchedOutsideException.length > 0) {
    record(
      "PROP-016",
      false,
      `src/ file(s) touched outside the DOC-CONSTRAINT-001a version-literal exception: ${srcTouchedOutsideException.join(", ")}`,
    );
    return;
  }
  record(
    "PROP-016",
    true,
    `all ${changedFiles.length} changed path(s) within allow-list; zero test/dist touches; src/ touch (if any) limited to index.ts (line-level checked by PROP-016b)`,
  );
}

// ---------------------------------------------------------------------------
// PROP-016b — DOC-CONSTRAINT-001a's version-literal exception, LINE-level check
// ---------------------------------------------------------------------------

function checkProp016b() {
  // Same FROZEN two-commit range as PROP-016 above (blockrun-cli-docs's own
  // init..converge-complete) — a permanent historical fact, not an ongoing gate.
  // NEW files added under src/ within that COMPLETED range are a violation
  // (DOC-CONSTRAINT-001a only permits modifying an existing line in an existing
  // file, never adding a new one) — checked via `--name-status` (git's "A" marker)
  // BEFORE the line-level diff below. This replaces the old
  // `git ls-files --others` (current-working-tree "untracked files") check, which
  // has no meaning for a completed, fully-committed historical range.
  let addedSrc;
  try {
    const out = execFileSync(
      "git",
      ["diff", "--name-status", `${DOCS_FEATURE_START_COMMIT}~1`, DOCS_FEATURE_END_COMMIT, "--", "src/"],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    ).trim();
    const lines = out.length > 0 ? out.split("\n") : [];
    addedSrc = lines.filter((l) => l.startsWith("A\t")).map((l) => l.slice(2));
  } catch (e) {
    record("PROP-016b", false, `git diff --name-status -- src/ failed: ${e.message}`);
    return;
  }
  if (addedSrc.length > 0) {
    record("PROP-016b", false, `NEW file(s) added under src/ within the frozen range (not permitted by the narrow exception): ${addedSrc.join(", ")}`);
    return;
  }
  let diffOutput;
  try {
    diffOutput = execFileSync(
      "git",
      ["diff", `${DOCS_FEATURE_START_COMMIT}~1`, DOCS_FEATURE_END_COMMIT, "--unified=0", "--", "src/"],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
  } catch (e) {
    record("PROP-016b", false, `git diff -- src/ failed: ${e.message}`);
    return;
  }
  if (diffOutput.trim().length === 0) {
    record("PROP-016b", true, "no changes under src/ at all (exception not exercised — trivially satisfied)");
    return;
  }
  // With --unified=0, changed-content lines are exactly the lines starting with a
  // single '+' or '-' (not '+++'/'---' file headers, not '@@' hunk headers).
  const contentLines = diffOutput
    .split("\n")
    .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
  if (contentLines.length !== 2) {
    record(
      "PROP-016b",
      false,
      `expected exactly 2 diff lines under src/ (1 removed + 1 added, i.e. one changed line) — got ${contentLines.length}: ${JSON.stringify(contentLines)}`,
    );
    return;
  }
  const versionLiteralRe = /\.version\(\s*["'][\d.]+["']\s*\)/;
  const bothMatch = contentLines.every((l) => versionLiteralRe.test(l));
  if (!bothMatch) {
    record(
      "PROP-016b",
      false,
      `the single changed src/ line does not match the .version("...") literal pattern: ${JSON.stringify(contentLines)}`,
    );
    return;
  }
  record("PROP-016b", true, "src/ diff is exactly one line, matching the .version(\"...\") release-literal exception");
}

// ---------------------------------------------------------------------------
// PROP-017 — forbidden placeholder set across CHANGELOG/CONTRIBUTING/LICENSE/PARITY.md
// ---------------------------------------------------------------------------

function checkProp017() {
  const files = [
    ["CHANGELOG.md", readFileOpt(repoPath("CHANGELOG.md"))],
    ["CONTRIBUTING.md", readFileOpt(repoPath("CONTRIBUTING.md"))],
    ["LICENSE", readFileOpt(repoPath("LICENSE"))],
    ["PARITY.md", readFileOpt(repoPath("PARITY.md"))],
  ];
  const placeholders = ["coming soon", "tbd", "planned"];
  const problems = [];
  for (const [label, text] of files) {
    if (text === null) {
      problems.push(`${label} does not exist`);
      continue;
    }
    const lower = text.toLowerCase();
    const hits = placeholders.filter((p) => lower.includes(p));
    if (hits.length > 0) problems.push(`${label}: ${hits.join(",")}`);
  }
  if (problems.length > 0) {
    record("PROP-017", false, problems.join("; "));
    return;
  }
  record("PROP-017", true, "CHANGELOG/CONTRIBUTING/LICENSE/PARITY.md free of forbidden placeholders");
}

// ---------------------------------------------------------------------------
// PROP-024 — PARITY.md 9/9 tier partition
// ---------------------------------------------------------------------------

function checkProp024() {
  const parity = readFileOpt(repoPath("PARITY.md"));
  if (parity === null) {
    record("PROP-024", false, "PARITY.md does not exist");
    return;
  }
  const sections = parsePARITYSections(parity);
  const problems = [];
  for (const name of DUAL_LIVE_RUN_COMMANDS) {
    const body = sections[name] ?? "";
    const hasDual = /DUAL-LIVE-RUN/.test(body);
    const hasSchema = /SCHEMA-ONLY/.test(body);
    if (!hasDual || hasSchema) problems.push(`${name}: expected DUAL-LIVE-RUN only, got dual=${hasDual} schema=${hasSchema}`);
  }
  for (const name of SCHEMA_ONLY_COMMANDS) {
    const body = sections[name] ?? "";
    const hasDual = /DUAL-LIVE-RUN/.test(body);
    const hasSchema = /SCHEMA-ONLY/.test(body);
    if (!hasSchema || hasDual) problems.push(`${name}: expected SCHEMA-ONLY only, got dual=${hasDual} schema=${hasSchema}`);
  }
  if (problems.length > 0) {
    record("PROP-024", false, `tier-label mismatch(es): ${problems.join("; ")}`);
    return;
  }
  record("PROP-024", true, "9 DUAL-LIVE-RUN + 9 SCHEMA-ONLY partition exactly matches spec");
}

// ---------------------------------------------------------------------------
// PROP-025 — SCHEMA-ONLY tier static parameter-mapping cross-check
// ---------------------------------------------------------------------------

function checkProp025() {
  const parity = readFileOpt(repoPath("PARITY.md"));
  if (parity === null) {
    record("PROP-025", false, "PARITY.md does not exist");
    return;
  }
  const sections = parsePARITYSections(parity);
  const problems = [];
  for (const name of SCHEMA_ONLY_COMMANDS) {
    const body = sections[name] ?? "";
    const normalizedBody = normalize(body);
    const mcpParams = SCHEMA_ONLY_MCP_PARAMS[name] ?? [];
    const missing = mcpParams.filter((p) => !normalizedBody.includes(normalize(p)));
    if (missing.length > 0) {
      problems.push(`${name}: MCP param(s) not referenced in PARITY.md section: ${missing.join(",")}`);
    }
  }
  if (problems.length > 0) {
    record("PROP-025", false, problems.join("; "));
    return;
  }
  record("PROP-025", true, "every MCP-declared parameter for all 9 SCHEMA-ONLY commands is referenced in PARITY.md");
}

// ---------------------------------------------------------------------------
// PROP-022 — 3-document cross-check: PARITY.md <-> evidence/*.json <-> VERIFICATION.md
// (DOC-EVID-004/-005; Tier 1, cross-file, no network) — added Phase 3/4, was
// missing from the original Phase 2a Tier-1 list despite being classified Tier 1
// in verification-architecture.md.
// ---------------------------------------------------------------------------

const MEDIA_EVIDENCE_COMMANDS = ["image", "video", "music"];

function checkProp022() {
  const parity = readFileOpt(repoPath("PARITY.md"));
  const verification = readFileOpt(repoPath("VERIFICATION.md"));
  if (parity === null) {
    record("PROP-022", false, "PARITY.md does not exist");
    return;
  }
  if (verification === null) {
    record("PROP-022", false, "VERIFICATION.md does not exist");
    return;
  }
  const sections = parsePARITYSections(parity);
  const problems = [];
  for (const name of MEDIA_EVIDENCE_COMMANDS) {
    const evidencePath = repoPath(".vcsdd/features/blockrun-cli-docs/evidence", `${name}.json`);
    const evidenceRaw = readFileOpt(evidencePath);
    if (evidenceRaw === null) {
      problems.push(`${name}: evidence/${name}.json does not exist`);
      continue;
    }
    let evidence;
    try {
      evidence = JSON.parse(evidenceRaw);
    } catch (e) {
      problems.push(`${name}: evidence/${name}.json is not valid JSON: ${e.message}`);
      continue;
    }
    const fullUrl = evidence.fullUrl;
    const md5 = evidence.md5;
    if (typeof fullUrl !== "string" || typeof md5 !== "string") {
      problems.push(`${name}: evidence/${name}.json missing fullUrl/md5 field`);
      continue;
    }
    const body = sections[name] ?? "";
    if (!body.includes(`evidence/${name}.json`) && !body.includes(`evidence/${name}`)) {
      problems.push(`${name}: PARITY.md section does not reference evidence/${name}.json`);
    }
    if (!body.includes(md5)) {
      problems.push(`${name}: PARITY.md section does not quote MD5 ${md5}`);
    }
    if (!verification.includes(fullUrl)) {
      problems.push(`${name}: VERIFICATION.md does not contain the full URL ${fullUrl}`);
    }
  }
  if (problems.length > 0) {
    record("PROP-022", false, problems.join("; "));
    return;
  }
  record("PROP-022", true, "PARITY.md, VERIFICATION.md, and evidence/*.json agree on full URL + MD5 for image/video/music");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  let realNames;
  try {
    realNames = getRealCommandNames();
  } catch (e) {
    console.error(`FATAL: could not determine real command names: ${e.message}`);
    process.exit(1);
  }
  // 19 as of blockrun-cli-agent-dx (REQ-DX-001): the 18 original paid/free commands
  // PLUS the new `commands` introspection subcommand itself. `commands` is
  // deliberately excluded from checkProp012's PARITY.md per-command section check
  // (REQ-DX-033 — it has NO MCP-tool equivalent to mirror), so it is filtered back
  // out there specifically, not here.
  if (realNames.length !== 19) {
    console.error(`FATAL: expected 19 real commands from --help, got ${realNames.length}: ${realNames.join(",")}`);
    process.exit(1);
  }

  checkProp001();
  checkProp002(realNames);
  checkProp003();
  checkProp006();
  checkProp007();
  checkProp008();
  checkProp009();
  checkProp010();
  checkProp011();
  checkProp012(realNames);
  checkProp013();
  checkProp015();
  checkProp016();
  checkProp016b();
  checkProp017();
  checkProp022();
  checkProp024();
  checkProp025();

  results.sort((a, b) => {
    const na = parseInt(a.id.split("-")[1], 10);
    const nb = parseInt(b.id.split("-")[1], 10);
    return na - nb;
  });

  let failCount = 0;
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    if (!r.ok) failCount++;
    console.log(`[${status}] ${r.id}: ${r.detail}`);
  }
  console.log("");
  console.log(`${results.length} checks run, ${results.length - failCount} PASS, ${failCount} FAIL`);
  process.exit(failCount > 0 ? failCount : 0);
}

main();
