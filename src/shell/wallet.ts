// Impure shell: the SINGLE chokepoint for @blockrun/llm client construction and
// ~/.blockrun/* file reads (verification-architecture.md §1.2, §5 grep-audit),
// mirroring blockrun-mcp's src/utils/wallet.ts convention (getClient()) — ported,
// not reimplemented (REQ-015, REQ-221).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  LLMClient,
  ImageClient,
  PriceClient,
  SolanaLLMClient,
  AnthropicClient,
  getOrCreateWallet,
  getOrCreateSolanaWallet,
  loadSolanaWallet,
  getPaymentLinks,
  formatWalletCreatedMessage,
  SOLANA_WALLET_FILE_PATH,
} from "@blockrun/llm";

export type ApiClient = LLMClient | SolanaLLMClient;

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

const BLOCKRUN_DIR = path.join(os.homedir(), ".blockrun");
const CHAIN_PREFERENCE_FILES = [
  path.join(BLOCKRUN_DIR, ".chain"),
  path.join(BLOCKRUN_DIR, "payment-chain"),
];

let _evmClient: LLMClient | null = null;
let _imageClient: ImageClient | null = null;
let _priceClient: PriceClient | null = null;
let _freePriceClient: PriceClient | null = null;
let _evmWalletInfo: { address: string; privateKey: string; isNew: boolean } | null = null;
let _solanaClient: SolanaLLMClient | null = null;
let _anthropicClient: AnthropicClient | null = null;

function readChainPreference(): "base" | "solana" | null {
  for (const file of CHAIN_PREFERENCE_FILES) {
    try {
      if (!fs.existsSync(file)) continue;
      const value = fs.readFileSync(file, "utf-8").trim().toLowerCase();
      if (value === "base" || value === "solana") return value;
    } catch { /* ignore */ }
  }
  return null;
}

export function getChain(): "base" | "solana" {
  const preferred = readChainPreference();
  if (preferred) return preferred;
  if (process.env.SOLANA_WALLET_KEY) return "solana";
  try {
    if (fs.existsSync(SOLANA_WALLET_FILE_PATH) &&
        fs.readFileSync(SOLANA_WALLET_FILE_PATH, "utf-8").trim()) {
      return "solana";
    }
  } catch { /* ignore */ }
  return "base";
}

const CHAIN_FILE = path.join(BLOCKRUN_DIR, ".chain");

function resetChainCaches(): void {
  _evmClient = null;
  _solanaClient = null;
  _anthropicClient = null;
  _imageClient = null;
  _priceClient = null;
  _freePriceClient = null;
}

export function setChain(chain: "base" | "solana"): void {
  fs.mkdirSync(BLOCKRUN_DIR, { recursive: true });
  fs.writeFileSync(CHAIN_FILE, chain, { mode: 0o600 });
  resetChainCaches();
}

export async function ensureBothWallets(): Promise<{
  base: { address: string; isNew: boolean };
  solana: { address: string; isNew: boolean };
}> {
  const evm = ensureEvmWallet();
  const sol = await getOrCreateSolanaWallet();
  if (sol.isNew) {
    console.error(formatWalletCreatedMessage(sol.address));
  }
  return {
    base: { address: evm.address, isNew: evm.isNew },
    solana: { address: sol.address, isNew: sol.isNew },
  };
}

function ensureEvmWallet() {
  if (!_evmWalletInfo) {
    _evmWalletInfo = getOrCreateWallet();
    if (_evmWalletInfo.isNew) {
      console.error(formatWalletCreatedMessage(_evmWalletInfo.address));
    }
  }
  return _evmWalletInfo;
}

export function getOrCreateWalletKey(): `0x${string}` {
  const info = ensureEvmWallet();
  return info.privateKey as `0x${string}`;
}

function buildSolanaClient(timeout?: number): SolanaLLMClient {
  const privateKey = process.env.SOLANA_WALLET_KEY || loadSolanaWallet() || undefined;
  const opts = { ...(privateKey ? { privateKey } : {}), ...(timeout ? { timeout } : {}) };
  return new SolanaLLMClient(Object.keys(opts).length ? opts : undefined);
}

export function getClient(): ApiClient {
  if (getChain() === "solana") {
    if (!_solanaClient) _solanaClient = buildSolanaClient();
    return _solanaClient;
  }
  if (!_evmClient) {
    const privateKey = getOrCreateWalletKey();
    _evmClient = new LLMClient({ privateKey });
  }
  return _evmClient;
}

/** Non-cached client with an explicit HTTP timeout (modal/sandbox-exec — long-running). */
export function buildClientWithTimeout(timeoutMs: number): ApiClient {
  if (getChain() === "solana") return buildSolanaClient(timeoutMs);
  const privateKey = getOrCreateWalletKey();
  return new LLMClient({ privateKey, timeout: timeoutMs });
}

/** Fresh (non-cached) client so a per-call getSpending() delta isolates THIS call's cost. */
export function buildClient(): ApiClient {
  if (getChain() === "solana") return buildSolanaClient();
  return new LLMClient({ privateKey: getOrCreateWalletKey() });
}

/** Native Anthropic client → BlockRun's /v1/messages endpoint (verbatim claude-* passthrough). */
export function getAnthropicClient(): AnthropicClient {
  if (!_anthropicClient) {
    const privateKey = getOrCreateWalletKey();
    _anthropicClient = new AnthropicClient({ privateKey });
  }
  return _anthropicClient;
}

export function getImageClient(): ImageClient {
  if (!_imageClient) {
    const privateKey = getOrCreateWalletKey();
    _imageClient = new ImageClient({ privateKey });
  }
  return _imageClient;
}

export function getPriceClient(requireWallet = true): PriceClient {
  if (!requireWallet) {
    if (!_freePriceClient) _freePriceClient = new PriceClient({ requireWallet: false });
    return _freePriceClient;
  }
  if (!_priceClient) {
    const privateKey = getOrCreateWalletKey();
    _priceClient = new PriceClient({ privateKey });
  }
  return _priceClient;
}

export async function getWalletInfo() {
  if (getChain() === "solana") {
    const client = getClient() as SolanaLLMClient;
    const address = await client.getWalletAddress();
    return {
      address,
      network: "Solana" as const,
      chainId: null as number | null,
      currency: "USDC",
      isNew: false,
      explorerUrl: `https://solscan.io/account/${address}`,
      fundingUrl: "https://sol.blockrun.ai",
    };
  }
  const info = ensureEvmWallet();
  const links = getPaymentLinks(info.address);
  return {
    address: info.address,
    network: "Base" as const,
    chainId: 8453 as number | null,
    currency: "USDC",
    isNew: info.isNew,
    explorerUrl: links.basescan,
    fundingUrl: links.blockrun,
  };
}

async function getSolanaUsdcBalance(): Promise<number | null> {
  try {
    return await buildSolanaClient().getBalance();
  } catch { return null; }
}

export function parseBaseUsdcCallResult(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^0x[0-9a-fA-F]+$/.test(raw)) return null;
  return Number(BigInt(raw)) / 1e6;
}

async function getBaseUsdcBalance(address: string): Promise<number | null> {
  const data = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: USDC_ADDRESS, data: `0x70a08231000000000000000000000000${address.slice(2)}` }, "latest"],
    id: 1,
  };
  for (const rpcUrl of BASE_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json() as { result?: string };
      const usd = parseBaseUsdcCallResult(result.result);
      if (usd !== null) return usd;
    } catch { continue; }
  }
  return null;
}

export async function getChainBalance(chain: "base" | "solana", address: string): Promise<number | null> {
  return chain === "solana" ? getSolanaUsdcBalance() : getBaseUsdcBalance(address);
}
