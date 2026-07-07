// Verbatim port of blockrun-mcp's src/utils/path-safety.ts (verification-architecture.md §1.1).
export function hasPathTraversal(path: string): boolean {
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch { /* malformed %: check raw */ }
  return decoded.split(/[/\\]/).some((seg) => seg === ".." || seg === ".");
}

export function normalizeClassifyPath(path: string): string {
  return path
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function isValidNetworkSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}
