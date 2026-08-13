import "server-only";
import { prisma } from "@/backend/database/prisma";

const REPORT_HOLD_MS = 90 * 24 * 60 * 60 * 1_000;

export function messagingParticipantProjection(input: {
  id: string;
  name: string;
  image: string | null;
  state: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DELETED";
}) {
  return input.state === "DELETED"
    ? { id: input.id, name: "Deleted user", image: null }
    : { id: input.id, name: input.name, image: input.image };
}

export class ApplyMessagingDataLifecycleService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async acknowledgeDeletedAccount(userId: string) {
    const [account, messageCount] = await Promise.all([
      this.db.userAccount.findFirst({
        where: { id: userId, state: "DELETED", deletedAt: { not: null } },
        select: { id: true },
      }),
      this.db.messagingMessage.count({ where: { senderId: userId } }),
    ]);
    if (!account) throw new Error("ACCOUNT_NOT_DELETED");
    // Messages remain immutable and indefinitely retained. Identity is
    // anonymized at every projection through messagingParticipantProjection.
    return { retainedMessageCount: messageCount, displayName: "Deleted user" as const };
  }

  async applyReportHandlingHold(reportId: string, handledAt = new Date()) {
    const minimum = new Date(handledAt.getTime() + REPORT_HOLD_MS);
    const current = await this.db.messagingReport.findUnique({
      where: { id: reportId },
      select: { preserveUntil: true },
    });
    if (!current) throw new Error("REPORT_UNAVAILABLE");
    const preserveUntil =
      current.preserveUntil && current.preserveUntil > minimum
        ? current.preserveUntil
        : minimum;
    return this.db.messagingReport.update({
      where: { id: reportId },
      data: { handledAt, preserveUntil },
      select: { id: true, handledAt: true, preserveUntil: true },
    });
  }
}
