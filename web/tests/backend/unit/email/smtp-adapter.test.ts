import { describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";
import {
  SmtpEmailAdapter,
  smtpTransportOptions,
} from "@/backend/email/smtp-adapter";

const gmail587 = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: 587,
  SMTP_USERNAME: "developer@gmail.com",
  SMTP_PASSWORD: "app-password",
  SMTP_FROM: "SmartHire <developer@gmail.com>",
  SMTP_SECURE: false,
  SMTP_USE_TLS: true,
};
const message = {
  kind: "VERIFY_EMAIL" as const,
  recipient: "user@example.test",
  subject: "Verify",
  html: "<p>Verify</p>",
  text: "Verify",
  idempotencyKey: "verification:test",
};

describe("SMTP adapter", () => {
  it("configures port 587 with STARTTLS and port 465 with implicit TLS", () => {
    expect(smtpTransportOptions(gmail587)).toMatchObject({
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "developer@gmail.com", pass: "app-password" },
    });
    expect(
      smtpTransportOptions({
        ...gmail587,
        SMTP_PORT: 465,
        SMTP_SECURE: true,
        SMTP_USE_TLS: false,
      }),
    ).toMatchObject({ port: 465, secure: true, requireTLS: false });
  });
  it("delivers with a mocked SMTP transport without passing credentials to sendMail", async () => {
    const sendMail = vi
      .fn()
      .mockResolvedValue({ messageId: "smtp-message-id" });
    const factory = vi
      .fn()
      .mockReturnValue({ sendMail } as unknown as Transporter);
    await expect(
      new SmtpEmailAdapter(gmail587, factory).send(message),
    ).resolves.toEqual({ providerMessageId: "smtp-message-id" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: gmail587.SMTP_FROM,
        to: message.recipient,
        headers: { "X-SmartHire-Idempotency-Key": message.idempotencyKey },
      }),
    );
    expect(JSON.stringify(sendMail.mock.calls)).not.toContain(
      gmail587.SMTP_PASSWORD,
    );
  });
  it.each([
    ["authentication", { code: "EAUTH" }, "SMTP_AUTH_FAILED", false],
    [
      "connection timeout",
      { code: "ETIMEDOUT" },
      "SMTP_CONNECTION_TIMEOUT",
      true,
    ],
    [
      "temporary response",
      { responseCode: 451 },
      "SMTP_TEMPORARY_FAILURE",
      true,
    ],
    ["terminal response", { responseCode: 550 }, "SMTP_REJECTED", false],
  ])("maps %s failures safely", async (_name, failure, code, retryable) => {
    const factory = vi.fn().mockReturnValue({
      sendMail: vi
        .fn()
        .mockRejectedValue({ ...failure, message: "secret app-password" }),
    } as unknown as Transporter);
    await expect(
      new SmtpEmailAdapter(gmail587, factory).send(message),
    ).rejects.toMatchObject({
      code,
      retryable,
      message: "Email delivery failed",
    });
  });
  it("does not log SMTP secrets", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const factory = vi.fn().mockReturnValue({
      sendMail: vi.fn().mockRejectedValue({
        code: "EAUTH",
        message: gmail587.SMTP_PASSWORD,
      }),
    } as unknown as Transporter);
    await new SmtpEmailAdapter(gmail587, factory)
      .send(message)
      .catch(() => undefined);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
