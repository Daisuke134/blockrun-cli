// REQ-101–107, REQ-107a. `blockrun wallet` — always free (no x402), but
// budget/delegate/revoke/report read/write the PERSISTED ledger
// (~/.blockrun/cli-budget.json), not the ephemeral in-memory BudgetState.
import { buildRequest } from "../args/wallet.js";
import { ensureBaseWallet, ensureBothWallets, getChain, getChainBalance, getWalletInfo, peekSolanaWallet, setChain } from "../shell/wallet.js";
import { generateQrPng, openQrInViewer } from "../shell/qr.js";
import { readLedger, writeLedgerAtomic } from "../shell/budget-store.js";
import { extractErrorMessage } from "../core/errors.js";
import { ok, fail } from "../core/render.js";
import type { BudgetState } from "../types.js";
import type { CommandOutcome } from "../core/render.js";

export async function run(
  flags: Record<string, unknown>,
  opts: { json: boolean },
  _budget: BudgetState,
): Promise<CommandOutcome> {
  const built = buildRequest(flags);
  if (!built.ok) return fail(built.error, opts.json);
  const { action, chain: targetChain, budgetAction, budgetAmount, agentId, agentLimit } = built.value;

  try {
    if (action === "budget") {
      const ledger = readLedger();
      const act = budgetAction ?? "check";
      if (act === "set") {
        if (budgetAmount === undefined || budgetAmount <= 0) {
          return fail("Provide a positive --budget-amount (e.g. 1.00 for $1.00)", opts.json);
        }
        ledger.global.limit = budgetAmount;
        writeLedgerAtomic(ledger);
      } else if (act === "clear") {
        ledger.global.limit = null;
        writeLedgerAtomic(ledger);
      }
      const remaining = ledger.global.limit !== null ? ledger.global.limit - ledger.global.spent : null;
      return ok(
        { limit: ledger.global.limit, spent: ledger.global.spent, calls: ledger.global.calls, remaining },
        opts.json,
        `Global budget: ${ledger.global.limit !== null ? `$${ledger.global.limit.toFixed(2)}` : "Unlimited"} | Spent: $${ledger.global.spent.toFixed(4)} | Calls: ${ledger.global.calls}`,
      );
    }

    if (action === "delegate") {
      if (!agentId) return fail("--agent-id is required for --action delegate", opts.json);
      if (!agentLimit || agentLimit <= 0) return fail("--agent-limit (a positive number) is required for --action delegate", opts.json);
      const ledger = readLedger();
      ledger.agents[agentId] = { limit: agentLimit, spent: 0, calls: 0 };
      writeLedgerAtomic(ledger);
      return ok(
        { agent_id: agentId, limit: agentLimit, spent: 0, calls: 0 },
        opts.json,
        `Agent "${agentId}" allocated $${agentLimit.toFixed(2)} budget.`,
      );
    }

    if (action === "revoke") {
      if (!agentId) return fail("--agent-id is required for --action revoke", opts.json);
      const ledger = readLedger();
      const existed = Object.prototype.hasOwnProperty.call(ledger.agents, agentId);
      delete ledger.agents[agentId];
      writeLedgerAtomic(ledger);
      return ok(
        { agent_id: agentId, revoked: existed },
        opts.json,
        existed ? `Agent "${agentId}" budget revoked.` : `Agent "${agentId}" had no budget entry.`,
      );
    }

    if (action === "report") {
      const ledger = readLedger();
      const agentRows: Record<string, { limit: number; spent: number; calls: number; remaining: number }> = {};
      for (const [id, ab] of Object.entries(ledger.agents)) {
        agentRows[id] = { limit: ab.limit, spent: ab.spent, calls: ab.calls, remaining: Math.max(0, ab.limit - ab.spent) };
      }
      const lines = [
        `Global: $${ledger.global.spent.toFixed(4)} spent${ledger.global.limit ? ` / $${ledger.global.limit.toFixed(2)} limit` : " (no limit)"} — ${ledger.global.calls} calls`,
        ``,
        `Per-agent budgets (${Object.keys(agentRows).length} active):`,
        ...Object.entries(agentRows).map(([id, ab]) => `  ${id}: $${ab.spent.toFixed(4)}/$${ab.limit.toFixed(2)} (${ab.calls} calls, $${ab.remaining.toFixed(4)} remaining)`),
      ];
      return ok(
        { global: { limit: ledger.global.limit, spent: ledger.global.spent, calls: ledger.global.calls }, agents: agentRows },
        opts.json,
        lines.join("\n"),
      );
    }

    if (action === "chain") {
      // REQ-016a/impl-review FIND-007: capture the CURRENT chain BEFORE touching
      // any Solana wallet state, and only CREATE a Solana wallet when the caller
      // explicitly requests it (--chain solana). blockrun-mcp's wallet.ts:150-155
      // unconditionally calls ensureBothWallets() (which auto-creates
      // ~/.blockrun/.solana-session) before getChain() runs — under the CLI's
      // one-shot-process model that would make REQ-016's own rule 3 ("non-empty
      // .solana-session exists -> solana") self-trigger on a fresh user's very
      // first invocation (even a view-only one with no --chain flag), permanently
      // rerouting their default chain to Solana and breaking every Base-only paid
      // command (video/music/speech/realface) afterward. Deliberately NOT
      // inherited here — this is real payment-routing harm, not a cosmetic quirk.
      const currentChain = getChain();
      const wantsSolana = targetChain === "solana";
      const base = ensureBaseWallet();
      const solana = wantsSolana
        ? (await ensureBothWallets()).solana
        : await peekSolanaWallet();
      if (targetChain && targetChain !== currentChain) setChain(targetChain);
      const active = targetChain ?? currentChain;
      const activeAddress = active === "solana" ? solana?.address : base.address;
      const activeBalance = activeAddress ? await getChainBalance(active, activeAddress) : null;
      return ok(
        { activeChain: active, base: base.address, solana: solana?.address ?? null, activeBalance },
        opts.json,
        `Active chain: ${active.toUpperCase()}\nBase: ${base.address}\nSolana: ${solana?.address ?? "(not yet created — run: blockrun wallet --action chain --chain solana)"}`,
      );
    }

    const info = await getWalletInfo();
    const chain = getChain();

    if (action === "deposit") {
      return ok(
        { chain, address: info.address, note: "Fund your wallet with USDC on the active chain." },
        opts.json,
        `Fund ${info.address} with USDC on ${chain === "solana" ? "Solana" : "Base"}.`,
      );
    }

    if (action === "qr" || action === "setup") {
      let qrPath: string | undefined;
      try {
        qrPath = await generateQrPng(info.address, chain);
        await openQrInViewer(qrPath);
      } catch {
        qrPath = undefined;
      }
      return ok(
        { chain, address: info.address, qrPath: qrPath ?? null },
        opts.json,
        `Wallet address (${chain}): ${info.address}${qrPath ? `\nQR saved: ${qrPath}` : ""}`,
      );
    }

    // Default: status — show BOTH wallets, mark the active one. REQ-016a: this is
    // a Base-default/view-only operation, so it must NOT create a Solana wallet as
    // a side effect (ensureBothWallets() would) — peek only, same as the `chain`
    // action above. When no Solana wallet exists yet, its address/balance are
    // reported as null rather than fabricated by creating one just to display it.
    const base = ensureBaseWallet();
    const solanaPeek = await peekSolanaWallet();
    const [baseBal, solBal] = await Promise.all([
      getChainBalance("base", base.address),
      solanaPeek ? getChainBalance("solana", solanaPeek.address) : Promise.resolve(null),
    ]);
    return ok(
      {
        activeChain: chain,
        base: { address: base.address, balance: baseBal },
        solana: solanaPeek ? { address: solanaPeek.address, balance: solBal } : null,
      },
      opts.json,
      `Active chain: ${chain.toUpperCase()}\nBase:   ${base.address} (${baseBal !== null ? `$${baseBal.toFixed(6)} USDC` : "unavailable"})\nSolana: ${solanaPeek ? `${solanaPeek.address} (${solBal !== null ? `$${solBal.toFixed(6)} USDC` : "unavailable"})` : "(not yet created — run: blockrun wallet --action chain --chain solana)"}`,
    );
  } catch (err) {
    return fail(extractErrorMessage(err), opts.json, { chain: getChain() });
  }
}
