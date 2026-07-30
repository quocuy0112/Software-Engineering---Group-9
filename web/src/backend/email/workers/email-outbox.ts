import "server-only";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import { createElement } from "react";
import { serverEnvironment } from "@/backend/env/runtime";
import { safeErrorCode } from "@/backend/security/redaction";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import {
  PrismaOutboxRepository,
  type ClaimedOutbox,
} from "@/backend/repositories/email/outbox-repository";
import { CaptureEmailAdapter } from "../capture-adapter";
import { ResendEmailAdapter } from "../resend-adapter";
import { SmtpEmailAdapter } from "../smtp-adapter";
import {
  VerifyEmailTemplate,
  verificationEmailText,
} from "../templates/verify-email";
import { ResetPasswordTemplate, resetPasswordEmailText } from "../templates/reset-password";
import { PasswordChangedTemplate, passwordChangedEmailText } from "../templates/password-changed";
import { EmailDeliveryError, type EmailService } from "../email-service";
const protector = new TokenProtector();
export function selectedEmailAdapter(): EmailService {
  if (serverEnvironment.EMAIL_ADAPTER === "capture")
    return new CaptureEmailAdapter();
  if (serverEnvironment.EMAIL_ADAPTER === "smtp") return new SmtpEmailAdapter();
  return new ResendEmailAdapter();
}
export function retryAt(attempts: number, now: Date, random = Math.random) {
  const baseSeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
  return new Date(
    now.getTime() + Math.round(baseSeconds * (0.9 + random() * 0.2)) * 1000,
  );
}
export async function deliverClaimedOutbox(
  row: ClaimedOutbox,
  owner: string,
  adapter: EmailService = selectedEmailAdapter(),
  repository = new PrismaOutboxRepository(),
  now = new Date(),
  random = Math.random,
): Promise<boolean> {
  try {
    if (!row.user) throw new Error("MISSING_RECIPIENT");
    const payload = row.payloadRef as { protectedToken?: string };
    let subject: string;
    let html: string;
    let text: string;
    const recoveryPayload = row.payloadRef as {
      event?: string;
      protectedProof?: string;
      protectedCompletionProof?: string;
      protectedCancellationProof?: string;
      holdEndsAt?: string;
    };
    if (row.templateVersion === "account-recovery-confirmation.v1") {
      if (!recoveryPayload.protectedProof)
        throw new Error("MISSING_PROTECTED_TOKEN");
      const proof = protector.unseal(recoveryPayload.protectedProof);
      const url = new URL(
        "/account-recovery/confirm",
        serverEnvironment.NEXT_PUBLIC_APP_URL,
      );
      url.hash = `proof=${encodeURIComponent(proof)}`;
      subject = "Confirm your SmartHire account recovery";
      html = `<p>Confirm this SmartHire account-recovery request:</p><p><a href="${url.toString()}">Confirm account recovery</a></p><p>Email-only recovery is lower assurance than using your password and second factor.</p>`;
      text = `Confirm your SmartHire account recovery: ${url.toString()}\n\nEmail-only recovery is lower assurance than using your password and second factor.`;
    } else if (row.templateVersion === "account-recovery-pending.v1") {
      if (
        !recoveryPayload.protectedCompletionProof ||
        !recoveryPayload.protectedCancellationProof
      )
        throw new Error("MISSING_PROTECTED_TOKEN");
      const completionProof = protector.unseal(
        recoveryPayload.protectedCompletionProof,
      );
      const cancellationProof = protector.unseal(
        recoveryPayload.protectedCancellationProof,
      );
      const completionUrl = new URL(
        "/account-recovery/complete",
        serverEnvironment.NEXT_PUBLIC_APP_URL,
      );
      completionUrl.hash = `proof=${encodeURIComponent(completionProof)}`;
      const cancellationUrl = new URL(
        "/account-recovery/cancel",
        serverEnvironment.NEXT_PUBLIC_APP_URL,
      );
      cancellationUrl.hash = `proof=${encodeURIComponent(cancellationProof)}`;
      subject = "Your SmartHire account recovery is on hold";
      html = `<p>Your SmartHire account recovery has a 24-hour security hold.</p><p><a href="${cancellationUrl.toString()}">Cancel recovery</a></p><p>After the hold ends, <a href="${completionUrl.toString()}">complete recovery</a>.</p><p>Email-only recovery is lower assurance than using your password and second factor.</p>`;
      text = `Your SmartHire account recovery has a 24-hour security hold.\nCancel recovery: ${cancellationUrl.toString()}\nComplete recovery after the hold: ${completionUrl.toString()}\n\nEmail-only recovery is lower assurance than using your password and second factor.`;
    } else if (row.templateVersion === "account-recovery-cancelled.v1") {
      subject = "Your SmartHire account recovery was cancelled";
      html = "<p>Your SmartHire account recovery was cancelled. Your existing password and second factor remain authoritative.</p>";
      text =
        "Your SmartHire account recovery was cancelled. Your existing password and second factor remain authoritative.";
    } else if (row.templateVersion === "account-recovery-completed.v1") {
      subject = "Your SmartHire account recovery is complete";
      html = "<p>Your SmartHire account recovery is complete. Sign in with your new password, then re-enroll two-factor authentication.</p>";
      text =
        "Your SmartHire account recovery is complete. Sign in with your new password, then re-enroll two-factor authentication.";
    } else if (row.kind === "PASSWORD_CHANGED") {
      subject = "Your SmartHire password was changed";
      html = await render(createElement(PasswordChangedTemplate));
      text = passwordChangedEmailText();
    } else {
      if (!payload.protectedToken) throw new Error("MISSING_PROTECTED_TOKEN");
      const token = protector.unseal(payload.protectedToken);
      if (row.kind === "RESET_PASSWORD") {
        const url = new URL("/reset-password", serverEnvironment.NEXT_PUBLIC_APP_URL);
        url.hash = `token=${encodeURIComponent(token)}`;
        subject = "Reset your SmartHire password";
        html = await render(createElement(ResetPasswordTemplate, { resetUrl: url.toString() }));
        text = resetPasswordEmailText(url.toString());
      } else {
        const url = new URL("/verify-email", serverEnvironment.NEXT_PUBLIC_APP_URL);
        url.searchParams.set("token", token);
        subject = "Verify your SmartHire email";
        html = await render(createElement(VerifyEmailTemplate, { verificationUrl: url.toString() }));
        text = verificationEmailText(url.toString());
      }
    }
    const delivery = await adapter.send({
      kind: row.kind,
      recipient: row.user.email,
      subject,
      html,
      text,
      idempotencyKey: row.idempotencyKey,
    });
    return (
      (await repository.markSent(row.id, owner, delivery.providerMessageId))
        .count === 1
    );
  } catch (error) {
    const retryable = !(error instanceof EmailDeliveryError) || error.retryable;
    await repository.markFailure({
      id: row.id,
      owner,
      attempts: row.attempts,
      code: safeErrorCode(error),
      retryable,
      nextAttemptAt: retryAt(row.attempts, now, random),
      kind: row.kind,
    });
    return false;
  }
}
export async function deliverOutboxMessage(
  outboxId: string,
  adapterOverride?: EmailService,
): Promise<boolean> {
  const owner = `direct:${randomUUID()}`;
  const repository = new PrismaOutboxRepository();
  const now = new Date();
  const row = await repository.claimOne(outboxId, owner, now);
  if (!row) return false;
  return deliverClaimedOutbox(
    row,
    owner,
    adapterOverride ?? selectedEmailAdapter(),
    repository,
    now,
  );
}
