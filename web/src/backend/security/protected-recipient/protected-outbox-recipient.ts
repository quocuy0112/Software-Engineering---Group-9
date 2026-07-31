import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { serverEnvironment } from "@/backend/env/runtime";

export const protectedRecipientPurposes = [
  "email-change-verification.v1",
  "email-change-old-address.v1",
  "password-change-notice.v1",
] as const;

export type ProtectedRecipientPurpose =
  (typeof protectedRecipientPurposes)[number];

const version = "v1";
const mailbox = /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/u;

function assertPurpose(
  value: string,
): asserts value is ProtectedRecipientPurpose {
  if (!(protectedRecipientPurposes as readonly string[]).includes(value)) {
    throw new Error("PROTECTED_RECIPIENT_PURPOSE_INVALID");
  }
}

function assertRecipient(value: string): void {
  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
  if (value.length > 320 || !mailbox.test(value) || hasControlCharacter) {
    throw new Error("PROTECTED_RECIPIENT_INVALID");
  }
}

export class ProtectedOutboxRecipient {
  constructor(private readonly secret = serverEnvironment.TOKEN_SECRET) {
    if (Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("PROTECTED_RECIPIENT_SECRET_INVALID");
    }
  }

  private key(purpose: ProtectedRecipientPurpose): Buffer {
    return Buffer.from(
      hkdfSync(
        "sha256",
        Buffer.from(this.secret, "utf8"),
        Buffer.from("smarthire:protected-recipient:v1", "utf8"),
        Buffer.from(purpose, "utf8"),
        32,
      ),
    );
  }

  seal(recipient: string, purpose: ProtectedRecipientPurpose): string {
    assertPurpose(purpose);
    assertRecipient(recipient);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(purpose), iv);
    cipher.setAAD(Buffer.from(`${version}:${purpose}`, "utf8"));
    const encrypted = Buffer.concat([
      cipher.update(recipient, "utf8"),
      cipher.final(),
    ]);
    return [
      version,
      iv.toString("base64url"),
      encrypted.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
    ].join(".");
  }

  unseal(protectedValue: string, purpose: ProtectedRecipientPurpose): string {
    assertPurpose(purpose);
    const [storedVersion, ivValue, encryptedValue, tagValue, extra] =
      protectedValue.split(".");
    if (
      storedVersion !== version ||
      !ivValue ||
      !encryptedValue ||
      !tagValue ||
      extra
    ) {
      throw new Error("PROTECTED_RECIPIENT_INVALID");
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key(purpose),
        Buffer.from(ivValue, "base64url"),
      );
      decipher.setAAD(Buffer.from(`${version}:${purpose}`, "utf8"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      const recipient = Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      assertRecipient(recipient);
      return recipient;
    } catch {
      throw new Error("PROTECTED_RECIPIENT_INVALID");
    }
  }
}
