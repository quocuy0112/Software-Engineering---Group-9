import "server-only";
import { Resend, type ErrorResponse } from "resend";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  EmailDeliveryError,
  type EmailDelivery,
  type EmailMessage,
  type EmailService,
} from "./email-service";

export function mapResendError(error: ErrorResponse): EmailDeliveryError {
  const status = error.statusCode;
  const retryable =
    status === null
      ? error.name === "application_error" ||
        error.name === "internal_server_error"
      : status === 408 ||
        status === 409 ||
        status === 425 ||
        status === 429 ||
        status >= 500;
  return new EmailDeliveryError("EMAIL_PROVIDER_REJECTED", retryable);
}

export class ResendEmailAdapter implements EmailService {
  constructor(
    private readonly clientFactory: (
      apiKey: string,
    ) => Pick<Resend, "emails"> = (apiKey) => new Resend(apiKey),
    private readonly configuration = {
      apiKey: serverEnvironment.RESEND_API_KEY,
      from: serverEnvironment.EMAIL_FROM,
    },
  ) {}
  async send(message: EmailMessage): Promise<EmailDelivery> {
    if (!this.configuration.apiKey || !this.configuration.from)
      throw new EmailDeliveryError("EMAIL_PROVIDER_NOT_CONFIGURED", false);
    try {
      const response = await this.clientFactory(
        this.configuration.apiKey,
      ).emails.send({
        from: this.configuration.from,
        to: message.recipient,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: { "Idempotency-Key": message.idempotencyKey },
      });
      if (response.error) throw mapResendError(response.error);
      if (!response.data?.id)
        throw new EmailDeliveryError("EMAIL_PROVIDER_REJECTED", true);
      return { providerMessageId: response.data.id };
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError("EMAIL_PROVIDER_UNAVAILABLE", true);
    }
  }
}
