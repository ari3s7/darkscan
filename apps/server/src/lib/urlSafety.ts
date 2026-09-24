import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_NAME =
  /^(?:localhost|.*\.localhost|.*\.local|.*\.internal|.*\.intranet|.*\.localdomain|metadata\.google\.internal)$/i;

/** Returns a client-safe reason, or null when the URL may be crawled. */
export async function publicUrlProblem(
  raw: string,
  allowPrivateHosts: boolean,
  cache?: Map<string, string | null>,
): Promise<string | null> {
  if (raw.length > 2048) return "url is too long";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "url must be a valid absolute URL";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "url must use http or https";
  if (url.username || url.password) return "url must not include credentials";
  if (allowPrivateHosts) return null;

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || BLOCKED_NAME.test(host)) return "url must not target a local or private network";
  const literal = ipLiteral(host);
  if (literal) return isPrivateIp(literal) ? "url must not target a local or private network" : null;

  const cached = cache?.get(host);
  if (cached !== undefined) return cached;
  const problem = await lookupProblem(host);
  cache?.set(host, problem);
  return problem;
}

export function isPrivateIp(address: string): boolean {
  const host = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (host.startsWith("::ffff:")) return isPrivateIp(host.slice("::ffff:".length));
  if (isIP(host) === 6) return isPrivateIpv6(host);
  const ipv4 = ipLiteral(host);
  if (!ipv4) return false;
  const value = ipv4ToInt(ipv4);
  if (value === null) return true;
  return PRIVATE_V4.some((range) => inRange(value, range.base, range.bits));
}

function ipLiteral(host: string): string | null {
  if (isIP(host) === 4) return host;
  if (/^\d+$/.test(host)) {
    const value = Number(host);
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) return null;
    return `${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`;
  }
  const parts = host.split(".");
  if (parts.length < 2 || parts.length > 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((part) => part > 255)) return null;
  const padded = [...Array.from({ length: 4 - parts.length }, () => 0), ...nums];
  return padded.join(".");
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  const c = parts[2] ?? 0;
  const d = parts[3] ?? 0;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function inRange(ip: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (base >>> 0 & mask);
}

const PRIVATE_V4: readonly { base: number; bits: number }[] = [
  { base: ipv4ToInt("0.0.0.0") ?? 0, bits: 8 },
  { base: ipv4ToInt("10.0.0.0") ?? 0, bits: 8 },
  { base: ipv4ToInt("100.64.0.0") ?? 0, bits: 10 },
  { base: ipv4ToInt("127.0.0.0") ?? 0, bits: 8 },
  { base: ipv4ToInt("169.254.0.0") ?? 0, bits: 16 },
  { base: ipv4ToInt("172.16.0.0") ?? 0, bits: 12 },
  { base: ipv4ToInt("192.0.0.0") ?? 0, bits: 24 },
  { base: ipv4ToInt("192.0.2.0") ?? 0, bits: 24 },
  { base: ipv4ToInt("192.168.0.0") ?? 0, bits: 16 },
  { base: ipv4ToInt("198.18.0.0") ?? 0, bits: 15 },
  { base: ipv4ToInt("198.51.100.0") ?? 0, bits: 24 },
  { base: ipv4ToInt("203.0.113.0") ?? 0, bits: 24 },
  { base: ipv4ToInt("224.0.0.0") ?? 0, bits: 4 },
  { base: ipv4ToInt("240.0.0.0") ?? 0, bits: 4 },
];

function isPrivateIpv6(host: string): boolean {
  if (host === "::" || host === "::1") return true;
  if (/^f[cd][0-9a-f]{0,2}:/i.test(host) || host.startsWith("fc") || host.startsWith("fd")) return true;
  if (/^fe[89ab][0-9a-f]?:/i.test(host)) return true;
  if (host.startsWith("ff")) return true;
  return false;
}

async function lookupProblem(hostname: string): Promise<string | null> {
  try {
    const records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("dns timeout")), 3000);
      }),
    ]);
    if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
      return "url must not target a local or private network";
    }
    return null;
  } catch {
    return "url could not be resolved to a public address";
  }
}
