// Verbatim port of blockrun-mcp's src/tools/phone.ts:25-35 (verification-architecture.md §1.1).
import { normalizeClassifyPath } from "../path-safety.js";

export function estimatePhoneCost(rawPath: string, hasBody: boolean): number {
  const path = normalizeClassifyPath(rawPath);
  if (!hasBody && path.startsWith("voice/call/")) return 0;
  if (path === "phone/numbers/release") return 0;
  if (path === "phone/lookup") return 0.01;
  if (path === "phone/lookup/fraud") return 0.05;
  if (path === "phone/numbers/buy" || path === "phone/numbers/renew") return 5;
  if (path === "phone/numbers/list") return 0.001;
  if (path === "voice/call") return 0.54;
  return hasBody ? 0.001 : 0;
}
