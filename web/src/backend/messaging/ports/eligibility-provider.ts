export type AuthorizedMessagingContext =
  | {
      type: "APPLICATION";
      reference: string;
      applicationId: string;
      companyId: string;
      label: string;
      companyName: string;
      jobTitle: string;
    }
  | {
      type: "PROFESSIONAL_CONNECTION";
      reference: string;
      professionalConnectionId: string;
      label: string;
      companyName: null;
      jobTitle: null;
    };

export interface MessagingEligibilityProvider {
  hasEligibleRelationship(userA: string, userB: string): Promise<boolean>;
  authorizeContext(input: {
    userA: string;
    userB: string;
    reference: string;
  }): Promise<AuthorizedMessagingContext | null>;
}

export interface MessagingEligibilityPort {
  canMessage(userA: string, userB: string): Promise<boolean>;
  authorizeContext(input: {
    userA: string;
    userB: string;
    type: AuthorizedMessagingContext["type"];
    reference: string;
  }): Promise<AuthorizedMessagingContext | null>;
}
