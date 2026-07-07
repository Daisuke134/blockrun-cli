// Verbatim port of blockrun-mcp's src/utils/ssrf.ts (verification-architecture.md §1.1,
// §5 grep-audit). Guards fetches of caller/model-supplied URLs against loopback,
// private, link-local/metadata, and CGNAT hosts — the realistic SSRF vectors for a
// server-side (or locally-run) fetch of a user-supplied URL. Not full DNS-rebinding
// protection (a public name resolving to a private IP still passes), but blocks the
// literal-host cases.
function ipv4Blocked(host: string): boolean | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null; // not a dotted-quad
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // malformed -> block
  const [a, b] = o;
  return (
    a === 0 ||                                  // 0.0.0.0/8
    a === 127 ||                                // loopback
    a === 10 ||                                 // private
    (a === 172 && b >= 16 && b <= 31) ||        // private
    (a === 192 && b === 168) ||                 // private
    (a === 169 && b === 254) ||                 // link-local (incl. metadata)
    (a === 100 && b >= 64 && b <= 127)          // CGNAT
  );
}

/**
 * True when a hostname must NOT be fetched: loopback, private, link-local/metadata,
 * CGNAT, or an internal-only name. Accepts bare hosts and bracketed IPv6 (`[::1]`).
 */
export function isBlockedFetchHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  // A fully-qualified name keeps its root dot through the WHATWG URL parser
  // (new URL("http://localhost./").hostname === "localhost."), which would slip
  // past the exact/endsWith name checks below while DNS still resolves it. Strip
  // trailing dots so "localhost." and "metadata.google.internal." are caught.
  host = host.replace(/\.+$/, "");
  if (!host) return true;

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;

  const v4 = ipv4Blocked(host);
  if (v4 !== null) return v4;

  // IPv6: loopback, unique-local (fc00::/7 -> fc/fd), link-local (fe80::/10),
  // unspecified, and IPv4-mapped (::ffff:a.b.c.d -> check the embedded v4).
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
    if (mapped) return ipv4Blocked(mapped[1]) === true;
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
      return ipv4Blocked(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`) === true;
    }
    return false;
  }

  return false;
}
