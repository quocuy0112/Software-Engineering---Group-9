import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/backend/generated/prisma/client";
import type {
  NotificationContextType,
  NotificationKind,
} from "@/shared/contracts/notifications";
import { createInAppNotification } from "./notification-service";
import { NotificationRecipientPolicy } from "./notification-recipient-policy";

type NotificationDb = PrismaClient | Prisma.TransactionClient;

export type ActionableAdministratorNotificationKind = Extract<
  NotificationKind,
  | "SUPPORT_CASE_RECEIVED"
  | "SUPPORT_REQUESTER_REPLIED"
  | "SUPPORT_CASE_REOPENED"
  | "MESSAGE_REPORT_RECEIVED_ADMIN"
  | "MODERATION_REPORT_RECEIVED_ADMIN"
  | "VERIFICATION_REVIEW_OVERDUE"
  | "DELIVERY_MANUAL_INTERVENTION_REQUIRED"
  | "JOB_POST_REVIEW_REQUESTED_ADMIN"
>;

export async function notifyActionableAdministrators(
  db: NotificationDb,
  input: {
    kind: ActionableAdministratorNotificationKind;
    eventKey: string;
    correlationId: string;
    occurredAt: Date;
    contextType: NotificationContextType;
    contextId: string;
    preferredRecipientUserId?: string | null;
    state?: string;
  },
) {
  const recipients = await new NotificationRecipientPolicy(
    db,
  ).activeAdministratorRecipients(
    input.occurredAt,
    input.preferredRecipientUserId,
  );
  for (const recipientUserId of recipients) {
    const identity = createHash("sha256")
      .update(`${input.kind}\0${input.eventKey}\0${recipientUserId}`)
      .digest("hex");
    await createInAppNotification(db, {
      recipientUserId,
      kind: input.kind,
      deduplicationKey: `admin-action:${input.kind}:${identity}`,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
      contextType: input.contextType,
      contextId: input.contextId,
      variables: {
        audience: "ADMIN",
        ...(input.state ? { state: input.state } : {}),
      },
      language: "EN",
    });
  }
  return { recipientCount: recipients.length };
}
