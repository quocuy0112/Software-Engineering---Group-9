import "server-only";
import type { z } from "zod";
import {
  createSupportCaseInputSchema,
  sendSupportMessageInputSchema,
} from "@/shared/contracts/support";
import { PrismaSupportRepository } from "@/backend/repositories/support/prisma-support-repository";
import { supportRealtimePublisher } from "../realtime/support-realtime-hub";

export class RequesterSupportService {
  constructor(private readonly repository = new PrismaSupportRepository()) {}

  list(userId: string) {
    return this.repository.listRequester(userId);
  }

  detail(caseId: string, userId: string) {
    return this.repository.detailRequester(caseId, userId);
  }

  async create(
    userId: string,
    input: z.infer<typeof createSupportCaseInputSchema>,
    now = new Date(),
  ) {
    const result = await this.repository.runTransaction((repository) =>
      repository.createRequesterCase({ userId, ...input, now }),
    );
    if (!result.deduplicated) {
      await supportRealtimePublisher().publish(result.invalidation, userId);
    }
    return result;
  }

  async send(
    caseId: string,
    userId: string,
    input: z.infer<typeof sendSupportMessageInputSchema>,
    now = new Date(),
  ) {
    const result = await this.repository.runTransaction((repository) =>
      repository.sendRequesterMessage({ caseId, userId, ...input, now }),
    );
    if (!result.deduplicated) {
      await supportRealtimePublisher().publish(result.invalidation, userId);
    }
    return result;
  }
}
