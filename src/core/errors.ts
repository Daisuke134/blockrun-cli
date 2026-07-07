// Port of blockrun-mcp's src/utils/errors.ts (verification-architecture.md §1.1),
// with ONE deliberate deviation: the payment-error branch cannot read a cached
// getChain() (the CLI's pure core has no impure wallet-state import), so the chain
// is passed explicitly via opts.chain (default "base", matching the clone's own
// getChain() default).
export function extractErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { message?: unknown; response?: unknown; statusCode?: unknown };
  const base = typeof e.message === "string" ? e.message : String(err);
  if (e.response === undefined || e.response === null) return base;
  try {
    const body = e.response;
    if (typeof body === "string") return body.trim() ? `${base} — ${body}` : base;
    if (typeof body === "object") {
      const b = body as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof b.message === "string") parts.push(b.message);
      if (typeof b.hint === "string") parts.push(`Hint: ${b.hint}`);
      if (Array.isArray(b.missing_params) && b.missing_params.length) {
        parts.push(`Missing: ${b.missing_params.join(", ")}`);
      }
      if (parts.length === 0) {
        parts.push(JSON.stringify(b));
      }
      return `${base}\n${parts.join("\n")}`;
    }
  } catch { /* fall through */ }
  return base;
}

export function isPaymentRejectionError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("insufficient") || m.includes("balance") || m.includes("rejected");
}

export function formatError(message: string, opts?: { altModels?: string; chain?: "base" | "solana" }): string {
  const msgLower = message.toLowerCase();

  const hasStatus = (code: string) => new RegExp(`(^|[^0-9.])${code}($|[^0-9.])`).test(msgLower);

  const isPaymentError = hasStatus("402") ||
    msgLower.includes("balance") ||
    msgLower.includes("insufficient") ||
    (msgLower.includes("payment") && !hasStatus("500"));

  const isModelUnavailable =
    msgLower.includes("not active for requested provider") ||
    msgLower.includes("not found or not active");

  const isServerError = hasStatus("500") ||
    msgLower.includes("api error after payment");

  const altHint = opts?.altModels ? ` (e.g. ${opts.altModels})` : "";
  let errorText = `Error: ${message}`;

  if (isModelUnavailable) {
    errorText += `\n\nThis model is temporarily unavailable upstream` +
      (opts?.altModels
        ? `. Try a different model${altHint} — it should work right away.`
        : `. Try a different model, or retry shortly.`);
  } else if (isServerError) {
    errorText += `\n\nThis is a temporary API issue. The API may be experiencing problems.` +
      `\nTry again in a few minutes` +
      (opts?.altModels ? `, or use a different model${altHint}.` : `.`);
  } else if (isPaymentError) {
    const chain = opts?.chain ?? "base";
    const network = chain === "solana" ? "Solana" : "Base";
    errorText += `\n\nThis error usually means your wallet needs funding.\n` +
      `Run blockrun wallet with action "setup" to get funding instructions.\n\n` +
      `Quick fix: Send USDC to your wallet on ${network} network.`;
  }

  return errorText;
}
