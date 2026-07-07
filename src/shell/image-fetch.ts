// Impure shell: fetches/reads a user-supplied image reference (data URI, http(s) URL,
// or local file path) and converts it to a base64 data URI, since @blockrun/llm's
// ImageClient.edit() only accepts data:image/... URIs (REQ-127). Ported from
// blockrun-mcp's src/tools/image.ts:34-90 (toImageDataUri) — this is the ONE place in
// this CLI that performs a LOCAL fetch of a caller-supplied URL (video/realface's
// image_url/last_frame_url fields are instead forwarded verbatim to BlockRun's remote
// API, which fetches them server-side — see args/video.ts and args/realface.ts's own,
// separate defense-in-depth host check), so this is where the SSRF guard is load-bearing.
import { readFile } from "node:fs/promises";
import { isBlockedFetchHost } from "../core/ssrf.js";

const REFERENCE_IMAGE_MAX_BYTES = 4_000_000;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

const IMAGE_EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function toImageDataUri(ref: string): Promise<string> {
  if (ref.startsWith("data:image/")) return ref;

  if (/^https?:\/\//i.test(ref)) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      let url = ref;
      let res: Response;
      for (let hop = 0; ; hop++) {
        const host = new URL(url).hostname;
        if (isBlockedFetchHost(host)) {
          throw new Error(`refusing to fetch a private/loopback/link-local address: ${host}`);
        }
        res = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400 && location) {
          if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
          url = new URL(location, url).toString();
          continue;
        }
        break;
      }
      if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
      const mime = (res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
      if (!mime.startsWith("image/")) throw new Error(`URL returned non-image content-type: ${mime || "(none)"}`);
      const advertised = Number(res.headers.get("content-length"));
      if (Number.isFinite(advertised) && advertised > REFERENCE_IMAGE_MAX_BYTES) {
        throw new Error(`image too large: ${(advertised / 1e6).toFixed(1)}MB > ${REFERENCE_IMAGE_MAX_BYTES / 1e6}MB cap`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > REFERENCE_IMAGE_MAX_BYTES) {
        throw new Error(`image too large: ${(buffer.byteLength / 1e6).toFixed(1)}MB > ${REFERENCE_IMAGE_MAX_BYTES / 1e6}MB cap`);
      }
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Treat as a local file path.
  const ext = ref.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_EXT_MIME[ext];
  if (!mime) throw new Error(`unsupported image extension ".${ext}"; use png/jpg/jpeg/gif/webp`);
  const buffer = await readFile(ref);
  if (buffer.byteLength > REFERENCE_IMAGE_MAX_BYTES) {
    throw new Error(`image too large: ${(buffer.byteLength / 1e6).toFixed(1)}MB > ${REFERENCE_IMAGE_MAX_BYTES / 1e6}MB cap; resize or crop first`);
  }
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
