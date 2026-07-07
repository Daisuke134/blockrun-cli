// Impure shell: QR generation + system-viewer open, ported from blockrun-mcp's
// src/utils/qr.ts (minus the optional sharp logo overlay — cosmetic only, not
// required by any REQ). Uses the `qrcode` package (already a project dependency)
// and spawns the OS's own opener instead of adding the `open` npm package.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { spawn } from "node:child_process";
import QRCode from "qrcode";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = "8453";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function walletDir(): string {
  return join(homedir(), ".blockrun");
}

export function getEip681Uri(address: string, amountUsdc = 1.0): string {
  const amountWei = Math.floor(amountUsdc * 1_000_000);
  return `ethereum:${USDC_ADDRESS}@${BASE_CHAIN_ID}/transfer?address=${address}&uint256=${amountWei}`;
}

export function getSolanaPayUri(address: string, amountUsdc = 1.0): string {
  return `solana:${address}?spl-token=${SOLANA_USDC_MINT}&amount=${amountUsdc}&label=BlockRun`;
}

export async function generateQrPng(address: string, chain: "base" | "solana" = "base"): Promise<string> {
  const uri = chain === "solana" ? getSolanaPayUri(address) : getEip681Uri(address);
  const dir = walletDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const outPath = join(dir, "qr.png");
  await QRCode.toFile(outPath, uri, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return outPath;
}

export async function generateUrlQrPng(url: string, fileName = "realface-qr.png"): Promise<string> {
  const dir = walletDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const outPath = join(dir, fileName);
  await QRCode.toFile(outPath, url, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return outPath;
}

function openerCommand(): { cmd: string; args: (target: string) => string[] } {
  const p = platform();
  if (p === "darwin") return { cmd: "open", args: (t) => [t] };
  if (p === "win32") return { cmd: "cmd", args: (t) => ["/c", "start", "", t] };
  return { cmd: "xdg-open", args: (t) => [t] };
}

export async function openQrInViewer(qrPath: string): Promise<void> {
  try {
    const { cmd, args } = openerCommand();
    const child = spawn(cmd, args(qrPath), { detached: true, stdio: "ignore" });
    child.unref();
  } catch {
    // Silently fail — the caller always prints the path/address as a fallback.
  }
}

export async function openUrl(url: string): Promise<boolean> {
  try {
    const { cmd, args } = openerCommand();
    const child = spawn(cmd, args(url), { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
