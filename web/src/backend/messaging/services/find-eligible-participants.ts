import "server-only";
import { PrismaMessagingEligibilityRepository } from "@/backend/repositories/messaging/prisma-messaging-eligibility-repository";

export class FindEligibleParticipantsService {
  constructor(
    private readonly repository = new PrismaMessagingEligibilityRepository(),
  ) {}

  execute(input: { userId: string; q?: string; cursor?: string; limit: number }) {
    return this.repository.list(input);
  }
}
