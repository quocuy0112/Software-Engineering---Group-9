import "server-only";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import { createElement } from "react";
import { serverEnvironment } from "@/backend/env/runtime";
import { safeErrorCode } from "@/backend/security/redaction";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { EmailChangeProofProtector } from "@/backend/security/email-change-proof";
import {
  ProtectedOutboxRecipient,
  protectedRecipientPurposes,
  type ProtectedRecipientPurpose,
} from "@/backend/security/protected-recipient/protected-outbox-recipient";
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
import {
  ResetPasswordTemplate,
  resetPasswordEmailText,
} from "../templates/reset-password";
import {
  PasswordChangedTemplate,
  passwordChangedEmailText,
} from "../templates/password-changed";
import {
  EmailChangeVerificationTemplate,
  emailChangeVerificationText,
} from "../templates/email-change-verification";
import {
  EmailChangeAlertTemplate,
  emailChangeAlertText,
} from "../templates/email-change-alert";
import {
  CompanyEmailVerificationTemplate,
  companyEmailVerificationText,
} from "../templates/company-email-verification";
import {
  ApplicationStageChangedTemplate,
  applicationStageChangedEmailText,
} from "../templates/application-stage-changed";
import {
  applicationStageLabel,
  applicationStageSchema,
} from "@/shared/contracts/jobs/applications";
import { EmailDeliveryError, type EmailService } from "../email-service";
import { renderFeature006Email } from "@/backend/admin/notifications/renderer-registry";
import {
  alertSecurityNotificationDead,
  selectedSecurityNotificationOpsAlertAdapter,
  type SecurityNotificationOpsAlertAdapter,
} from "@/backend/admin/notifications/security-notification-ops-alert";
const protector = new TokenProtector();
const emailChangeProofs = new EmailChangeProofProtector();
const recipientProtector = new ProtectedOutboxRecipient();

function deliveryRecipient(row: ClaimedOutbox): string {
  if (row.recipientCiphertext || row.recipientPurpose) {
    if (
      !row.recipientCiphertext ||
      !row.recipientPurpose ||
      !(protectedRecipientPurposes as readonly string[]).includes(
        row.recipientPurpose,
      )
    ) {
      throw new Error("PROTECTED_RECIPIENT_INVALID");
    }
    return recipientProtector.unseal(
      row.recipientCiphertext,
      row.recipientPurpose as ProtectedRecipientPurpose,
    );
  }
  if (!row.user) throw new Error("MISSING_RECIPIENT");
  return row.user.email;
}
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
const FEATURE_006_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
] as const;
export function feature006RetryAt(attempts: number, now: Date) {
  const delay = FEATURE_006_RETRY_DELAYS_MS[Math.max(0, attempts - 1)];
  return new Date(now.getTime() + (delay ?? 0));
}
export async function deliverClaimedOutbox(
  row: ClaimedOutbox,
  owner: string,
  adapter: EmailService = selectedEmailAdapter(),
  repository = new PrismaOutboxRepository(),
  now = new Date(),
  random = Math.random,
  opsAlertAdapter: SecurityNotificationOpsAlertAdapter = selectedSecurityNotificationOpsAlertAdapter(),
): Promise<boolean> {
  const feature006Delivery =
    row.templateVersion === "admin-security-v1" ||
    row.templateVersion === "verification-v1" ||
    row.templateVersion === "support-case-v1" ||
    row.templateVersion === "professional-connection-v1" ||
    /^email-delivery:(account|membership|verification):/u.test(
      row.idempotencyKey,
    );
  const deliveryDeadline = feature006Delivery
    ? new Date(row.createdAt.getTime() + 24 * 60 * 60_000)
    : undefined;
  if (deliveryDeadline && now >= deliveryDeadline) {
    const failure = await repository.markFailure({
      id: row.id,
      owner,
      attempts: 5,
      code: "DELIVERY_DEADLINE_EXCEEDED",
      retryable: false,
      nextAttemptAt: now,
      kind: row.kind,
      now,
      deliveryDeadline,
    });
    if (failure.dead)
      await alertSecurityNotificationDead(
        row.id,
        opsAlertAdapter,
        undefined,
        now,
      ).catch(() => false);
    return false;
  }
  try {
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
    if (
      row.templateVersion === "admin-security-v1" ||
      row.templateVersion === "verification-v1" ||
      row.templateVersion === "support-case-v1" ||
      row.templateVersion === "professional-connection-v1"
    ) {
      const rendered = await renderFeature006Email({
        templateVersion: row.templateVersion,
        payloadRef: row.payloadRef,
        appUrl: serverEnvironment.NEXT_PUBLIC_APP_URL,
      });
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    } else if (row.templateVersion === "application-stage-changed.v1") {
      const stagePayload = row.payloadRef as {
        applicationId?: string;
        stage?: string;
        jobTitle?: string;
        companyName?: string;
      };
      const stage = applicationStageSchema.safeParse(stagePayload.stage);
      if (
        !stage.success ||
        !stagePayload.applicationId ||
        !stagePayload.jobTitle ||
        !stagePayload.companyName
      ) {
        throw new Error("APPLICATION_STAGE_EMAIL_PAYLOAD_INVALID");
      }
      const applicationUrl = new URL(
        `/jobs/applied/${encodeURIComponent(stagePayload.applicationId)}`,
        serverEnvironment.NEXT_PUBLIC_APP_URL,
      ).toString();
      const templateProps = {
        stageLabel: applicationStageLabel[stage.data],
        jobTitle: stagePayload.jobTitle,
        companyName: stagePayload.companyName,
        applicationUrl,
      };
      subject = `Application update: ${templateProps.stageLabel}`;
      html = await render(
        createElement(ApplicationStageChangedTemplate, templateProps),
      );
      text = applicationStageChangedEmailText(templateProps);
    } else if (row.templateVersion === "company-email-verification.v1") {
      if (!payload.protectedToken) throw new Error("MISSING_PROTECTED_TOKEN");
      const token = protector.unseal(payload.protectedToken);
      const verificationUrl = new URL(
        "/verify-company-email",
        serverEnvironment.NEXT_PUBLIC_APP_URL,
      );
      verificationUrl.hash = `company-email-token=${encodeURIComponent(token)}`;
      subject = "Verify your SmartHire company email";
      html = await render(
        createElement(CompanyEmailVerificationTemplate, {
          verificationUrl: verificationUrl.toString(),
        }),
      );
      text = companyEmailVerificationText(verificationUrl.toString());
    } else if (row.templateVersion === "email-change-verification.v1") {
      const emailChangePayload = row.payloadRef as {
        protectedProof?: string;
      };
      if (!emailChangePayload.protectedProof) {
        throw new Error("MISSING_PROTECTED_TOKEN");
      }
      const proof = emailChangeProofs.unseal(emailChangePayload.protectedProof);
      const verificationUrl = emailChangeProofs.fragmentUrl(proof);
      subject = "Verify your new SmartHire email";
      html = await render(
        createElement(EmailChangeVerificationTemplate, { verificationUrl }),
      );
      text = emailChangeVerificationText(verificationUrl);
    } else if (row.templateVersion === "email-change-alert.v1") {
      subject = "A SmartHire email change was requested";
      html = await render(createElement(EmailChangeAlertTemplate));
      text = emailChangeAlertText();
    } else if (row.templateVersion === "account-recovery-confirmation.v1") {
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
      html =
        "<p>Your SmartHire account recovery was cancelled. Your existing password and second factor remain authoritative.</p>";
      text =
        "Your SmartHire account recovery was cancelled. Your existing password and second factor remain authoritative.";
    } else if (row.templateVersion === "account-recovery-completed.v1") {
      subject = "Your SmartHire account recovery is complete";
      html =
        "<p>Your SmartHire account recovery is complete. Sign in with your new password, then re-enroll two-factor authentication.</p>";
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
        const url = new URL(
          "/reset-password",
          serverEnvironment.NEXT_PUBLIC_APP_URL,
        );
        url.hash = `token=${encodeURIComponent(token)}`;
        subject = "Reset your SmartHire password";
        html = await render(
          createElement(ResetPasswordTemplate, { resetUrl: url.toString() }),
        );
        text = resetPasswordEmailText(url.toString());
      } else {
        const url = new URL(
          "/verify-email",
          serverEnvironment.NEXT_PUBLIC_APP_URL,
        );
        url.searchParams.set("token", token);
        subject = "Verify your SmartHire email";
        html = await render(
          createElement(VerifyEmailTemplate, {
            verificationUrl: url.toString(),
          }),
        );
        text = verificationEmailText(url.toString());
      }
    }
    // Keep plaintext recipient material in process memory for the shortest
    // possible interval: unseal only after rendering and immediately before
    // invoking the selected provider adapter.
    const recipient = deliveryRecipient(row);
    const delivery = await adapter.send({
      kind: row.kind,
      recipient,
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
    const failure = await repository.markFailure({
      id: row.id,
      owner,
      attempts: row.attempts,
      code: safeErrorCode(error),
      retryable,
      nextAttemptAt: feature006Delivery
        ? feature006RetryAt(row.attempts, now)
        : retryAt(row.attempts, now, random),
      kind: row.kind,
      now,
      deliveryDeadline,
    });
    if (failure.dead)
      await alertSecurityNotificationDead(
        row.id,
        opsAlertAdapter,
        undefined,
        now,
      ).catch(() => false);
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
