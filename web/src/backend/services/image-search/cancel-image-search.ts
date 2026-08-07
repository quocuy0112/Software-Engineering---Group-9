import "server-only";

import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { ImageSearchServiceError } from "./image-search-errors";
import { appendImageSearchAudit } from "@/backend/repositories/audit/prisma-audit-repository";

export class CancelImageSearchService {
  constructor(
    private readonly dependencies: Readonly<{
      repository: PrismaImageSearchQueryRepository;
      capabilityHmacKey: Uint8Array;
      now(): Date;
    }>,
  ) {}

  async execute(input: {
    queryId: string;
    actor: ImageSearchActor;
    visitorCapability: string | null;
  }) {
    const now = this.dependencies.now();
    const query = await this.dependencies.repository
      .authorize({
        ...input,
        capabilityHmacKey: this.dependencies.capabilityHmacKey,
        now,
        allowInaccessible: true,
      })
      .catch(() => {
        throw new ImageSearchServiceError(
          404,
          "IMAGE_SEARCH_NOT_FOUND",
          "Image search was not found.",
        );
      });
    if (["CANCELLED", "DELETED", "CONSUMED", "EXPIRED"].includes(query.status))
      return;
    await this.dependencies.repository.makeContentInaccessible({
      queryId: query.id,
      now,
      status: "CANCELLED",
    });
    await appendImageSearchAudit({
      action: "image_search.cancelled",
      queryId: query.id,
      actorClass: query.actorClass,
      accountId: query.accountId,
      result: "SUCCESS",
      occurredAt: now,
      context: { status: "CANCELLED" },
    }).catch(() => undefined);
  }
}
