// Run with: npm test (tsx --test)
// PROP-FUND-007 (REQ-FUND-010, REQ-FUND-NG-004; mechanical grep-in-test-harness, same
// style as blockrun-cli-agent-dx's PROP-DX-014). A static regression guard: NONE of the
// 5 media commands (image/video/music/speech/realface) may call `payOnce(` a SECOND
// time inside their catch block, or import anything whose name matches
// /topUp|onramp|deposit/i — this would reintroduce blockrun-mcp's
// launchTopUp()-on-every-payment-failure pattern, which this feature deliberately does
// NOT port (REQ-FUND-010's rationale: no extra live network+signature call bolted onto
// an already-failed command's error path).
//
// This test is expected to ALREADY PASS today (Red phase carve-out) — the pattern it
// guards against was never introduced in the first place, so there is nothing to make
// RED here; it exists purely so a FUTURE regression (someone copying blockrun-mcp's
// launchTopUp()-in-catch pattern) is caught by `npm test` immediately.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MEDIA_COMMANDS = ["image", "video", "music", "speech", "realface"];
const COMMANDS_DIR = fileURLToPath(new URL("../../src/commands/", import.meta.url));

for (const name of MEDIA_COMMANDS) {
  test(`PROP-FUND-007: src/commands/${name}.ts does not call payOnce( a second time inside its catch block, or import an onramp/topup/deposit-named helper`, () => {
    const src = readFileSync(`${COMMANDS_DIR}${name}.ts`, "utf8");
    const catchBlockMatch = src.match(/}\s*catch\s*\([^)]*\)\s*{[\s\S]*$/);
    const catchBlock = catchBlockMatch ? catchBlockMatch[0] : "";
    assert.ok(
      !/payOnce\s*\(/.test(catchBlock),
      `${name}.ts's catch block must not call payOnce( a second time — that would reintroduce blockrun-mcp's launchTopUp()-on-failure auto-mint pattern (REQ-FUND-010)`,
    );
    assert.ok(
      !/import\s*\{[^}]*\b(topUp|onramp|launchTopUp)\b[^}]*\}/i.test(src),
      `${name}.ts must not import a topUp/onramp-named helper (REQ-FUND-NG-004)`,
    );
  });
}
