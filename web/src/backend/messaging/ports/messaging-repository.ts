import type {
  AuthorizedMessagingContext,
} from "./eligibility-provider";
import type { ConversationDetail } from "@/shared/contracts/messaging/conversations";

export type CanonicalParticipantPair = {
  participantLowId: string;
  participantHighId: string;
};

export function canonicalParticipantPair(
  userA: string,
  userB: string,
): CanonicalParticipantPair {
  if (userA === userB) throw new Error("SELF_CONVERSATION");
  return userA < userB
    ? { participantLowId: userA, participantHighId: userB }
    : { participantLowId: userB, participantHighId: userA };
}

export type ConversationAccess = {
  id: string;
  participantLowId: string;
  participantHighId: string;
  contextType: "APPLICATION" | "PROFESSIONAL_CONNECTION";
  contextReference: string;
  applicationId: string | null;
  companyId: string | null;
  professionalConnectionId: string | null;
  lastMessageSequence: number | null;
};

export interface MessagingConversationRepositoryPort {
  findAccess(conversationId: string, userId: string): Promise<ConversationAccess | null>;
  listAuthorizedConversationIds(userId: string): Promise<string[]>;
  open(input: {
    actorUserId: string;
    targetUserId: string;
    context: AuthorizedMessagingContext;
    now: Date;
  }): Promise<{ conversationId: string; created: boolean }>;
  getDetail?(conversationId: string, userId: string): Promise<ConversationDetail | null>;
}

export interface MessagingBlockRepositoryPort {
  isEitherDirectionBlocked(userA: string, userB: string): Promise<boolean>;
}

export type AcceptedMessage = {
  id: string;
  conversationId: string;
  sequence: number;
  senderId: string;
  content: string;
  createdAt: Date;
};

export interface MessagingMessageRepositoryPort {
  accept(input: {
    conversationId: string;
    senderId: string;
    clientOperationId: string;
    content: string;
    now: Date;
  }): Promise<{ message: AcceptedMessage; deduplicated: boolean }>;
}
