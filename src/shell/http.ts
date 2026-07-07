// Impure shell: shared fetch helpers (ported from blockrun-mcp's src/utils/http.ts,
// verification-architecture.md §1.2). fetchJson is the free-action helper used by
// dex/realface (init/status/list)/speech (voices) — never signs a payment.
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  id.unref?.();
  return await fetch(url, { ...options, signal: controller.signal });
}

export function isTimeoutError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || name === "TimeoutError") return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("abort") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("did not complete within")
  );
}

export interface FetchJsonResult {
  status: number;
  data: Record<string, any>;
}

export async function fetchJson(url: string, init?: RequestInit, timeoutMs = 30_000): Promise<FetchJsonResult> {
  const resp = await fetchWithTimeout(url, init ?? {}, timeoutMs);
  const data = await resp.json().catch(() => ({})) as Record<string, any>;
  return { status: resp.status, data };
}
