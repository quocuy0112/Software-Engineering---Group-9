import "server-only";
import { render } from "@react-email/render";
import { createElement } from "react";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";
import { safeErrorCode } from "@/lib/security/redaction";
import { TokenProtector } from "@/lib/security/security-tokens";
import { CaptureEmailAdapter } from "../capture-adapter";
import { ResendEmailAdapter } from "../resend-adapter";
import { SmtpEmailAdapter } from "../smtp-adapter";
import { VerifyEmailTemplate, verificationEmailText } from "../templates/verify-email";
import { EmailDeliveryError, type EmailService } from "../email-service";

const protector = new TokenProtector();

export async function deliverOutboxMessage(outboxId: string, adapterOverride?: EmailService): Promise<boolean> {
  const row = await prisma.emailOutbox.findUnique({ where: { id: outboxId }, include: { user: true } });
  if (!row || !row.user || row.status === "SENT" || row.status === "DEAD") return false;
  const payload = row.payloadRef as { protectedToken?: string };
  try {
    if (!payload.protectedToken) throw new Error("MISSING_PROTECTED_TOKEN");
    const token = protector.unseal(payload.protectedToken);
    const url = new URL("/verify-email", serverEnvironment.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("token", token);
    const adapter = adapterOverride ?? (serverEnvironment.EMAIL_ADAPTER === "capture" ? new CaptureEmailAdapter() : serverEnvironment.EMAIL_ADAPTER === "smtp" ? new SmtpEmailAdapter() : new ResendEmailAdapter());
    const delivery = await adapter.send({ kind: row.kind, recipient: row.user.email, subject: "Verify your SmartHire email", html: await render(createElement(VerifyEmailTemplate, { verificationUrl: url.toString() })), text: verificationEmailText(url.toString()), idempotencyKey: row.idempotencyKey });
    await prisma.emailOutbox.update({ where: { id: row.id }, data: { status: "SENT", attempts: { increment: 1 }, providerMessageId: delivery.providerMessageId, safeErrorCode: null } });
    return true;
  } catch (error) {
    const attempts = row.attempts + 1;
    const terminal = error instanceof EmailDeliveryError && !error.retryable;
    await prisma.$transaction(async (tx) => {
      await tx.emailOutbox.update({ where: { id: row.id }, data: { status: terminal || attempts >= 5 ? "DEAD" : "RETRYABLE", attempts, nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 30) * 1000), safeErrorCode: safeErrorCode(error) } });
      if (terminal || attempts >= 5) await tx.auditEvent.create({ data: { actorType: "system", action: "email.delivery_failed", targetType: "email_outbox", targetId: row.id, result: "FAILURE", correlationId: row.id, context: { kind: row.kind } } });
    });
    return false;
  }
}
