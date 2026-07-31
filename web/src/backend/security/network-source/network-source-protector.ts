import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { serverEnvironment } from "@/backend/env/runtime";

export type NetworkSourceInput = {
  remoteAddress: string | null | undefined;
  forwardedFor?: string | null;
};

function normalizeAddress(input: string): string {
  const value = input.trim().replace(/^\[|\]$/gu, "");
  const mapped = value.toLowerCase().startsWith("::ffff:")
    ? value.slice(7)
    : value;
  if (!isIP(mapped)) throw new Error("NETWORK_SOURCE_INVALID");
  return mapped;
}

function expandIpv6(input: string): number[] {
  const address = input.toLowerCase();
  const halves = address.split("::");
  if (halves.length > 2) throw new Error("NETWORK_SOURCE_INVALID");
  const parse = (part: string) =>
    part
      ? part.split(":").map((value) => {
          const parsed = Number.parseInt(value, 16);
          if (!/^[0-9a-f]{1,4}$/u.test(value) || Number.isNaN(parsed)) {
            throw new Error("NETWORK_SOURCE_INVALID");
          }
          return parsed;
        })
      : [];
  const left = parse(halves[0] ?? "");
  const right = parse(halves[1] ?? "");
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) {
    throw new Error("NETWORK_SOURCE_INVALID");
  }
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

export function reduceNetworkPrefix(input: string): string {
  const address = normalizeAddress(input);
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split(".").map(Number);
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  const groups = expandIpv6(address);
  groups[3] = (groups[3] ?? 0) & 0xff00;
  for (let index = 4; index < groups.length; index++) groups[index] = 0;
  const prefix = groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":");
  return `${prefix}::/56`;
}

export class NetworkSourceProtector {
  constructor(
    private readonly secret = serverEnvironment.TOKEN_SECRET,
    private readonly trustedProxyHops = serverEnvironment.AUDIT_TRUSTED_PROXY_HOPS,
  ) {
    if (Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("NETWORK_SOURCE_SECRET_INVALID");
    }
    if (
      !Number.isSafeInteger(trustedProxyHops) ||
      trustedProxyHops < 0 ||
      trustedProxyHops > 10
    ) {
      throw new Error("NETWORK_SOURCE_TRUST_INVALID");
    }
  }

  private selectAddress(input: NetworkSourceInput): string {
    if (!input.remoteAddress) throw new Error("NETWORK_SOURCE_UNAVAILABLE");
    const direct = normalizeAddress(input.remoteAddress);
    const forwarded = input.forwardedFor
      ? input.forwardedFor.split(",").map(normalizeAddress)
      : [];
    if (forwarded.length > 20) throw new Error("NETWORK_SOURCE_INVALID");
    const chain = [...forwarded, direct];
    const selectedIndex = chain.length - 1 - this.trustedProxyHops;
    if (selectedIndex < 0) throw new Error("NETWORK_SOURCE_UNAVAILABLE");
    if (this.trustedProxyHops === 0 && forwarded.length > 0) {
      return direct;
    }
    return chain[selectedIndex] as string;
  }

  protect(input: NetworkSourceInput): { ipPrefixDigest: string } {
    const prefix = reduceNetworkPrefix(this.selectAddress(input));
    return {
      ipPrefixDigest: createHmac("sha256", Buffer.from(this.secret, "utf8"))
        .update(`audit-ip-prefix:v1:${prefix}`, "utf8")
        .digest("base64url"),
    };
  }
}
