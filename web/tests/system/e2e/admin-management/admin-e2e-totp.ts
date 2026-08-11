import { createHmac } from "node:crypto";

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/u, "").toUpperCase().replace(/\s+/gu, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(output);
}

export function totp(secret: string, at = Date.now()) {
  const counter = Math.floor(at / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export async function freshTotp(
  secret: string,
  previousCode: string,
  timeoutMs = 35_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const code = totp(secret);
    if (code !== previousCode) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("ADMIN_E2E_FRESH_TOTP_TIMEOUT");
}

export function secretFromOtpAuthUri(uri: string) {
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret) throw new Error("ADMIN_E2E_TOTP_SECRET_MISSING");
  return secret;
}
