import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { serverEnvironment } from "@/backend/env/runtime";

export const EMAIL_CHANGE_PROOF_TTL_MS = 30 * 60 * 1_000;
const version = "v1";
const purpose = "email-change-proof.v1";

export class EmailChangeProofProtector {
  private readonly digestKey: Buffer;
  private readonly encryptionKey: Buffer;

  constructor(private readonly secret = serverEnvironment.TOKEN_SECRET) {
    if (Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("EMAIL_CHANGE_PROOF_SECRET_INVALID");
    }
    const key = (context: string) =>
      Buffer.from(
        hkdfSync(
          "sha256",
          Buffer.from(secret, "utf8"),
          Buffer.from("smarthire:email-change:v1", "utf8"),
          Buffer.from(context, "utf8"),
          32,
        ),
      );
    this.digestKey = key("proof-digest");
    this.encryptionKey = key("proof-seal");
  }

  generate(): string {
    return randomBytes(32).toString("base64url");
  }

  digest(proof: string): string {
    if (!/^[A-Za-z0-9_-]{32,512}$/u.test(proof)) {
      throw new Error("EMAIL_CHANGE_PROOF_INVALID");
    }
    return createHmac("sha256", this.digestKey)
      .update(proof, "utf8")
      .digest("hex");
  }

  seal(proof: string): string {
    this.digest(proof);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(`${version}:${purpose}`, "utf8"));
    const ciphertext = Buffer.concat([
      cipher.update(proof, "utf8"),
      cipher.final(),
    ]);
    return [
      version,
      iv.toString("base64url"),
      ciphertext.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
    ].join(".");
  }

  unseal(protectedProof: string): string {
    const [storedVersion, iv, ciphertext, tag, extra] =
      protectedProof.split(".");
    if (storedVersion !== version || !iv || !ciphertext || !tag || extra) {
      throw new Error("EMAIL_CHANGE_PROOF_INVALID");
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        Buffer.from(iv, "base64url"),
      );
      decipher.setAAD(Buffer.from(`${version}:${purpose}`, "utf8"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const proof = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      this.digest(proof);
      return proof;
    } catch {
      throw new Error("EMAIL_CHANGE_PROOF_INVALID");
    }
  }

  expiresAt(now: Date): Date {
    if (Number.isNaN(now.getTime())) {
      throw new Error("EMAIL_CHANGE_TIME_INVALID");
    }
    return new Date(now.getTime() + EMAIL_CHANGE_PROOF_TTL_MS);
  }

  isExpired(expiresAt: Date, now: Date): boolean {
    if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(now.getTime())) {
      throw new Error("EMAIL_CHANGE_TIME_INVALID");
    }
    return expiresAt.getTime() <= now.getTime();
  }

  fragmentUrl(
    proof: string,
    baseUrl = serverEnvironment.NEXT_PUBLIC_APP_URL,
  ): string {
    this.digest(proof);
    const url = new URL("/verify-email-change", baseUrl);
    url.hash = `proof=${encodeURIComponent(proof)}`;
    return url.toString();
  }
}
