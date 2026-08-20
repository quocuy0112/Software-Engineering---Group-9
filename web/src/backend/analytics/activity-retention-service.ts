import "server-only";

import {
  PrismaActivityRetentionRepository,
  type ActivityLegalHoldRow,
  type ActivityRetentionCandidate,
} from "@/backend/repositories/analytics/prisma-activity-retention-repository";

type ActivityRetentionRepository = {
  findExpiredCandidates(
    before: Date,
    take: number,
  ): Promise<readonly ActivityRetentionCandidate[]>;
  activeLegalHolds(now: Date): Promise<readonly ActivityLegalHoldRow[]>;
  deleteAuditEvents(
    ids: readonly string[],
  ): Promise<{ count: number }>;
};

export function auditRetentionDeadline(now: Date) {
  const deadline = new Date(now);
  deadline.setUTCFullYear(deadline.getUTCFullYear() - 2);
  return deadline;
}

function protectedByHold(
  event: ActivityRetentionCandidate,
  holds: readonly ActivityLegalHoldRow[],
  now: Date,
) {
  const targetReference = event.targetId
    ? event.targetType + ":" + event.targetId
    : null;
  return holds.some((hold) => {
    if (hold.endsAt <= now) {
      return false;
    }
    if (hold.releasedAt && hold.releasedAt <= now) return false;
    return (
      (hold.scopeType === "AUDIT_EVENT" && hold.scopeReference === event.id) ||
      (hold.scopeType === "CORRELATION" &&
        hold.scopeReference === event.correlationId) ||
      (hold.scopeType === "TARGET" && hold.scopeReference === targetReference)
    );
  });
}

export class ActivityRetentionService {
  constructor(
    private readonly repository: ActivityRetentionRepository =
      new PrismaActivityRetentionRepository(),
  ) {}

  async run(now = new Date(), take = 500) {
    const before = auditRetentionDeadline(now);
    const [candidates, holds] = await Promise.all([
      this.repository.findExpiredCandidates(before, take),
      this.repository.activeLegalHolds(now),
    ]);
    const deletable = candidates.filter(
      (event) => !protectedByHold(event, holds, now),
    );
    const result = await this.repository.deleteAuditEvents(
      deletable.map((event) => event.id),
    );
    return {
      eligible: candidates.length,
      held: candidates.length - deletable.length,
      deleted: result.count,
      retentionDeadline: before.toISOString(),
    };
  }
}
