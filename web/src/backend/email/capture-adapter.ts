import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { serverEnvironment } from "@/backend/env/runtime";
import type {
  EmailDelivery,
  EmailMessage,
  EmailService,
} from "./email-service";

export class CaptureEmailAdapter implements EmailService {
  async send(message: EmailMessage): Promise<EmailDelivery> {
    const configured = serverEnvironment.EMAIL_CAPTURE_DIR.split(
      String.fromCharCode(92),
    ).join("/");
    if (configured !== ".local/mail" && configured !== "local/mail")
      throw new Error("INVALID_EMAIL_CAPTURE_DIRECTORY");
    const directory = resolve(process.cwd(), ".local", "mail");
    await mkdir(directory, { recursive: true });
    const id = randomUUID();
    const body = [
      `To: ${message.recipient}`,
      `Subject: ${message.subject}`,
      `X-SmartHire-Kind: ${message.kind}`,
      `X-SmartHire-Idempotency-Key: ${message.idempotencyKey}`,
      "Content-Type: multipart/alternative",
      "",
      "--- TEXT ---",
      message.text,
      "",
      "--- HTML ---",
      message.html,
      "",
    ].join("\n");
    await writeFile(resolve(directory, `${Date.now()}-${id}.eml`), body, {
      encoding: "utf8",
      flag: "wx",
    });
    return { providerMessageId: `capture:${id}` };
  }
}
