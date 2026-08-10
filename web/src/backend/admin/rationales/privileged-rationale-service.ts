import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Prisma } from "@/backend/generated/prisma/client";
import { normalizeAdminPlainText } from "@/shared/contracts/admin/common";
import { PrismaPrivilegedRationaleRepository } from "@/backend/repositories/admin/prisma-privileged-rationale-repository";

function key() {
  const configured = process.env.ADMIN_RATIONALE_KEY_V1;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.byteLength === 32) return decoded;
  }
  return createHash("sha256")
    .update(process.env.TOKEN_SECRET ?? "test-only-admin-rationale")
    .digest();
}

export class PrivilegedRationaleService {
  async create(
    tx: Prisma.TransactionClient,
    input: { correlationId: string; explanation: string; actionAt: Date },
  ) {
    const text = normalizeAdminPlainText(input.explanation);
    if (Array.from(text).length < 10 || Array.from(text).length > 500) {
      throw new Error("RATIONALE_LENGTH_INVALID");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    return new PrismaPrivilegedRationaleRepository(tx).create({
      correlationId: input.correlationId,
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authenticationTag: cipher.getAuthTag().toString("base64"),
      encryptionKeyVersion: 1,
      inaccessibleAt: new Date(input.actionAt.getTime() + 365 * 86_400_000),
      deleteAfter: new Date(input.actionAt.getTime() + 366 * 86_400_000),
    });
  }

  async read(correlationId: string, now: Date, proofAt: Date) {
    if (now.getTime() - proofAt.getTime() > 15 * 60_000) {
      throw new Error("STEP_UP_REQUIRED");
    }
    const row = await new PrismaPrivilegedRationaleRepository().findAvailable(
      correlationId,
      now,
    );
    if (!row) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(row.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(row.authenticationTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}
