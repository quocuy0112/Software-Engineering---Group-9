import "server-only";
import { randomUUID } from "node:crypto";
import { TokenProtector } from "@/lib/security/security-tokens";
import { PrismaVerificationRepository } from "@/server/repositories/identity/prisma-verification-repository";

export class VerifyEmailService {
  constructor(
    private readonly repository = new PrismaVerificationRepository(),
    private readonly protector = new TokenProtector(),
  ) {}
  async execute(token: string, now?: Date) {
    try {
      const result = await this.repository.consume(
        this.protector.digest(token),
        randomUUID(),
        now,
      );
      return result === "verified"
        ? { success: true as const }
        : { success: false as const, reason: result };
    } catch {
      return { success: false as const, reason: "unavailable" as const };
    }
  }
}
