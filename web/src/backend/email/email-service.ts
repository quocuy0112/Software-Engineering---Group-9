import "server-only";
import type { EmailKind } from "@/backend/generated/prisma/enums";

export type EmailMessage = {
  kind: EmailKind;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailDelivery = { providerMessageId: string };

export interface EmailService {
  send(message: EmailMessage): Promise<EmailDelivery>;
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super("Email delivery failed");
    this.name = "EmailDeliveryError";
  }
}
