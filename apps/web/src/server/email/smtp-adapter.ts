import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { serverEnvironment } from "@/lib/env/runtime";
import {
  EmailDeliveryError,
  type EmailDelivery,
  type EmailMessage,
  type EmailService,
} from "./email-service";

export type SmtpConfiguration = {
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_FROM: string;
  SMTP_SECURE: boolean;
  SMTP_USE_TLS: boolean;
};

type TransportFactory = (options: SMTPTransport.Options) => Transporter;

export function smtpTransportOptions(
  config: SmtpConfiguration,
): SMTPTransport.Options {
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    requireTLS: config.SMTP_USE_TLS,
    auth: { user: config.SMTP_USERNAME, pass: config.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export function mapSmtpError(error: unknown): EmailDeliveryError {
  const value =
    error && typeof error === "object"
      ? (error as { code?: string; responseCode?: number })
      : {};
  if (value.code === "EAUTH")
    return new EmailDeliveryError("SMTP_AUTH_FAILED", false);
  if (
    value.code === "ETIMEDOUT" ||
    value.code === "ECONNECTION" ||
    value.code === "ESOCKET" ||
    value.code === "ECONNRESET"
  )
    return new EmailDeliveryError("SMTP_CONNECTION_TIMEOUT", true);
  if (
    value.responseCode &&
    value.responseCode >= 400 &&
    value.responseCode < 500
  )
    return new EmailDeliveryError("SMTP_TEMPORARY_FAILURE", true);
  if (value.responseCode && value.responseCode >= 500)
    return new EmailDeliveryError("SMTP_REJECTED", false);
  return new EmailDeliveryError("SMTP_DELIVERY_FAILED", true);
}

export class SmtpEmailAdapter implements EmailService {
  constructor(
    private readonly config: SmtpConfiguration = serverEnvironment as SmtpConfiguration,
    private readonly transportFactory: TransportFactory = (options) =>
      nodemailer.createTransport(options),
  ) {}

  async send(message: EmailMessage): Promise<EmailDelivery> {
    try {
      const result = await this.transportFactory(
        smtpTransportOptions(this.config),
      ).sendMail({
        from: this.config.SMTP_FROM,
        to: message.recipient,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: { "X-SmartHire-Idempotency-Key": message.idempotencyKey },
      });
      if (!result.messageId) throw { responseCode: 550 };
      return { providerMessageId: result.messageId };
    } catch (error) {
      throw mapSmtpError(error);
    }
  }
}
