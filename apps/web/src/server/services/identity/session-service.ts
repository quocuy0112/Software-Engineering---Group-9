import "server-only";
import { PrismaSessionPolicyRepository } from "@/server/repositories/identity/prisma-session-policy-repository";
export class SessionService {
  constructor(
    private readonly repository = new PrismaSessionPolicyRepository(),
  ) {}
  async enforceCreated(userId: string) {
    const current = await this.repository.newest(userId);
    return this.repository.enforceCap(userId, current?.id);
  }
  validate(id: string, userId: string, now?: Date) {
    return this.repository.validateAndTouch(id, userId, now);
  }
}
