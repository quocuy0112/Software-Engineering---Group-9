import "server-only";

import { prisma } from "@/backend/database/prisma";

export class CreateImageSearchFallbackService {
  async execute(input: {
    queryId: string;
    intentAttemptId: string;
    now: Date;
    failureCode: "INTERPRETER_UNAVAILABLE" | "INTERPRETER_INVALID_OUTPUT";
    leaseOwner: string;
  }) {
    await prisma.$transaction(async (transaction) => {
      const committed = await transaction.searchIntentAttempt.updateMany({
        where: {
          id: input.intentAttemptId,
          queryId: input.queryId,
          status: "PROCESSING",
          leaseOwner: input.leaseOwner,
          leaseExpiresAt: { gt: input.now },
          query: {
            status: "INTERPRETING",
            contentInaccessibleAt: null,
            deleteBy: { gt: input.now },
          },
        },
        data: {
          status: "FALLBACK_READY",
          failureCode: input.failureCode,
          completedAt: input.now,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      if (committed.count !== 1) throw new Error("STAGE_RESULT_DISCARDED");
      await transaction.searchImageQuery.update({
        where: { id: input.queryId },
        data: {
          status: "FALLBACK_READY",
          failureCode: input.failureCode,
          resultKind: "OCR_TEXT_FALLBACK",
          resultReadyAt: input.now,
        },
        select: { id: true },
      });
    });
  }
}
