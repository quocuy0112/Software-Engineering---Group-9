import { describe, expect, it } from "vitest";
import { OpenConversationService } from "@/backend/messaging/services/open-conversation";
import { canonicalParticipantPair } from "@/backend/messaging/ports/messaging-repository";
import type { MessagingEligibilityPort } from "@/backend/messaging/ports/eligibility-provider";

const applicationContext = {
  type: "APPLICATION" as const,
  reference: "application-1",
  applicationId: "application-1",
  companyId: "company-1",
  label: "Software Engineer",
  companyName: "SmartHire Test",
  jobTitle: "Software Engineer",
};

describe("conversation eligibility and uniqueness", () => {
  it("canonicalizes the participant pair", () => {
    expect(canonicalParticipantPair("user-z", "user-a")).toEqual({
      participantLowId: "user-a",
      participantHighId: "user-z",
    });
  });

  it("returns one conversation for concurrent equivalent opens", async () => {
    const rows = new Map<string, string>();
    const eligibility: MessagingEligibilityPort = {
      canMessage: async () => true,
      authorizeContext: async () => applicationContext,
    };
    const service = new OpenConversationService(
      eligibility,
      { isEitherDirectionBlocked: async () => false },
      {
        findAccess: async () => null,
        listAuthorizedConversationIds: async () => [],
        open: async ({ actorUserId, targetUserId, context }) => {
          const pair = canonicalParticipantPair(actorUserId, targetUserId);
          const key = `${pair.participantLowId}:${pair.participantHighId}:${context.reference}`;
          const current = rows.get(key);
          if (current) return { conversationId: current, created: false };
          await Promise.resolve();
          const winner = rows.get(key) ?? "conversation-1";
          rows.set(key, winner);
          return { conversationId: winner, created: !current };
        },
      },
      { append: async () => undefined },
    );
    const outcomes = await Promise.all([
      service.execute({ userId: "candidate", sessionId: "s1" }, "recruiter", {
        type: "APPLICATION",
        applicationId: "application-1",
      }),
      service.execute({ userId: "recruiter", sessionId: "s2" }, "candidate", {
        type: "APPLICATION",
        applicationId: "application-1",
      }),
    ]);
    expect(new Set(outcomes.map((item) => item.conversationId))).toEqual(
      new Set(["conversation-1"]),
    );
  });

  it("uses a neutral unavailable error for ineligible and cross-company contexts", async () => {
    const service = new OpenConversationService(
      { canMessage: async () => false, authorizeContext: async () => null },
      { isEitherDirectionBlocked: async () => false },
      {
        findAccess: async () => null,
        listAuthorizedConversationIds: async () => [],
        open: async () => ({ conversationId: "never", created: true }),
      },
      { append: async () => undefined },
    );
    await expect(
      service.execute({ userId: "candidate", sessionId: "s1" }, "outsider", {
        type: "APPLICATION",
        applicationId: "other-company-application",
      }),
    ).rejects.toMatchObject({ code: "CONVERSATION_UNAVAILABLE" });
  });
});
