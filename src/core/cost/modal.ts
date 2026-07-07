// Verbatim port of blockrun-mcp's src/tools/modal.ts:21-39 (verification-architecture.md §1.1).
export function estimateModalCost(path: string): number {
  return path.includes("sandbox/create") ? 0.01 : 0.001;
}

const MODAL_DEFAULT_TIMEOUT_S = 300;
const MODAL_MAX_TIMEOUT_S = 1800;
const MODAL_SLACK_MS = 15_000;

export function modalTimeoutMs(body: unknown): number {
  const raw = body && typeof body === "object" ? (body as { timeout?: unknown }).timeout : undefined;
  const requested = typeof raw === "number" && raw > 0 ? raw : MODAL_DEFAULT_TIMEOUT_S;
  const clamped = Math.min(Math.max(requested, MODAL_DEFAULT_TIMEOUT_S), MODAL_MAX_TIMEOUT_S);
  return clamped * 1000 + MODAL_SLACK_MS;
}
