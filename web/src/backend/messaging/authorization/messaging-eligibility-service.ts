import type {
  AuthorizedMessagingContext,
  MessagingEligibilityPort,
  MessagingEligibilityProvider,
} from "@/backend/messaging/ports/eligibility-provider";
import { ApplicationMessagingEligibility } from "./application-messaging-eligibility";
import { ProfessionalConnectionEligibility } from "./professional-connection-eligibility";

export class MessagingEligibilityService implements MessagingEligibilityPort {
  constructor(
    private readonly application: MessagingEligibilityProvider =
      new ApplicationMessagingEligibility(),
    private readonly connection: MessagingEligibilityProvider =
      new ProfessionalConnectionEligibility(),
  ) {}

  async canMessage(userA: string, userB: string): Promise<boolean> {
    if (!userA || !userB || userA === userB) return false;
    const [application, connection] = await Promise.all([
      this.application.hasEligibleRelationship(userA, userB),
      this.connection.hasEligibleRelationship(userA, userB),
    ]);
    return application || connection;
  }

  authorizeContext(input: {
    userA: string;
    userB: string;
    type: AuthorizedMessagingContext["type"];
    reference: string;
  }) {
    return input.type === "APPLICATION"
      ? this.application.authorizeContext(input)
      : this.connection.authorizeContext(input);
  }
}
