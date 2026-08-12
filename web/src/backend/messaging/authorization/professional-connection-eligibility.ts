import "server-only";
import { prisma } from "@/backend/database/prisma";
import { canonicalParticipantPair } from "@/backend/messaging/ports/messaging-repository";
import type {
  AuthorizedMessagingContext,
  MessagingEligibilityProvider,
} from "@/backend/messaging/ports/eligibility-provider";

export class ProfessionalConnectionEligibility
  implements MessagingEligibilityProvider
{
  constructor(private readonly db: typeof prisma = prisma) {}

  private async find(userA: string, userB: string, reference?: string) {
    if (userA === userB) return null;
    const pair = canonicalParticipantPair(userA, userB);
    return this.db.professionalConnection.findFirst({
      where: {
        ...(reference ? { id: reference } : {}),
        ...pair,
        state: "ACCEPTED",
        participantLow: { state: "ACTIVE" },
        participantHigh: { state: "ACTIVE" },
      },
      select: { id: true },
    });
  }

  async hasEligibleRelationship(userA: string, userB: string) {
    return Boolean(await this.find(userA, userB));
  }

  async authorizeContext(input: {
    userA: string;
    userB: string;
    reference: string;
  }): Promise<AuthorizedMessagingContext | null> {
    const connection = await this.find(input.userA, input.userB, input.reference);
    return connection
      ? {
          type: "PROFESSIONAL_CONNECTION",
          reference: connection.id,
          professionalConnectionId: connection.id,
          label: "Professional connection",
          companyName: null,
          jobTitle: null,
        }
      : null;
  }
}
