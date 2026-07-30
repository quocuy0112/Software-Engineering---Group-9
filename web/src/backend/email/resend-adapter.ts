import "server-only";
import { Resend } from "resend";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  EmailDeliveryError,
  type EmailDelivery,
  type EmailMessage,
  type EmailService,
} from "./email-service";

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
    if (response.error || !response.data?.id)
      throw new EmailDeliveryError("EMAIL_PROVIDER_REJECTED", true);
    return { providerMessageId: response.data.id };
  }
}
