import "server-only";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import { createElement } from "react";
import { serverEnvironment } from "@/lib/env/runtime";
import { safeErrorCode } from "@/lib/security/redaction";
import { TokenProtector } from "@/lib/security/security-tokens";
import { PrismaOutboxRepository, type ClaimedOutbox } from "@/server/repositories/email/outbox-repository";
import { CaptureEmailAdapter } from "../capture-adapter";
import { ResendEmailAdapter } from "../resend-adapter";
import { SmtpEmailAdapter } from "../smtp-adapter";
import { VerifyEmailTemplate, verificationEmailText } from "../templates/verify-email";
import { EmailDeliveryError, type EmailService } from "../email-service";
const protector = new TokenProtector();
export function selectedEmailAdapter(): EmailService {
  if (serverEnvironment.EMAIL_ADAPTER === "capture") return new CaptureEmailAdapter();
  if (serverEnvironment.EMAIL_ADAPTER === "smtp") return new SmtpEmailAdapter();
  return new ResendEmailAdapter();
}
export function retryAt(attempts: number, now: Date, random = Math.random) {
  const baseSeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
  return new Date(now.getTime() + Math.round(baseSeconds * (0.9 + random() * 0.2)) * 1000);
}
export async function deliverClaimedOutbox(row: ClaimedOutbox, owner: string, adapter: EmailService = selectedEmailAdapter(), repository = new PrismaOutboxRepository(), now = new Date(), random = Math.random): Promise<boolean> {
  try {
    if (!row.user) throw new Error("MISSING_RECIPIENT");
    const payload = row.payloadRef as { protectedToken?: string };
    if (!payload.protectedToken) throw new Error("MISSING_PROTECTED_TOKEN");
    const token = protector.unseal(payload.protectedToken);
    const url = new URL("/verify-email", serverEnvironment.NEXT_PUBLIC_APP_URL); url.searchParams.set("token", token);
    const delivery = await adapter.send({ kind: row.kind, recipient: row.user.email, subject: "Verify your SmartHire email", html: await render(createElement(VerifyEmailTemplate, { verificationUrl: url.toString() })), text: verificationEmailText(url.toString()), idempotencyKey: row.idempotencyKey });
    return (await repository.markSent(row.id, owner, delivery.providerMessageId)).count === 1;
  } catch (error) {
    const retryable = !(error instanceof EmailDeliveryError) || error.retryable;
    await repository.markFailure({ id: row.id, owner, attempts: row.attempts, code: safeErrorCode(error), retryable, nextAttemptAt: retryAt(row.attempts, now, random), kind: row.kind });
    return false;
  }
}
export async function deliverOutboxMessage(outboxId: string, adapterOverride?: EmailService): Promise<boolean> {
  const owner = `direct:${randomUUID()}`; const repository = new PrismaOutboxRepository(); const now = new Date();
  const row = await repository.claimOne(outboxId, owner, now); if (!row) return false;
  return deliverClaimedOutbox(row, owner, adapterOverride ?? selectedEmailAdapter(), repository, now);
}
