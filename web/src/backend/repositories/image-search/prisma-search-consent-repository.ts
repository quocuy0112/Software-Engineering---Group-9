import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import type { z } from "zod";

import type {
  searchConsentGrantSchema,
  searchConsentRequestSchema,
} from "@/shared/contracts/jobs/image-search";

type Decision = z.infer<typeof searchConsentRequestSchema>;
type Grant = z.infer<typeof searchConsentGrantSchema>;

type StoredIdempotentConsent = Readonly<{
  id: string;
  action: "GRANTED" | "REVOKED";
  provider: string;
  model: string;
  purposeVersion: string;
  noticeVersion: string;
  consentTextVersion: string;
  retentionDisclosureVersion: string;
  occurredAt: Date;
}>;

function grantFor(decision: Decision): Grant {
  return decision.action === "GRANTED"
    ? decision.grant
    : {
        provider: "openai",
        model: "gpt-5.4-mini-2026-03-17",
        purposeVersion: "job-image-search-purpose-v1",
        noticeVersion: "image-search-notice-v1",
        consentTextVersion: "image-search-consent-v1",
        retentionDisclosureVersion: "image-search-retention-v1",
      };
}

export class PrismaSearchConsentRepository {
  async latest(queryId: string) {
    return prisma.searchProcessingConsent.findFirst({
      where: { queryId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        action: true,
        provider: true,
        interpreterClass: true,
        model: true,
        purposeVersion: true,
        noticeVersion: true,
        consentTextVersion: true,
        retentionDisclosureVersion: true,
        occurredAt: true,
      },
    });
  }

  async append(input: {
    queryId: string;
    accountId: string | null;
    actorClass: "VISITOR" | "AUTHENTICATED";
    decision: Decision;
    idempotencyDigest: Uint8Array;
    now: Date;
  }) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${input.queryId}, 0))`;
      if (input.idempotencyDigest.byteLength !== 32)
        throw new Error("IMAGE_SEARCH_IDEMPOTENCY_DIGEST_INVALID");
      const digestHex = Buffer.from(input.idempotencyDigest).toString("hex");
      const replayRows = await transaction.$queryRaw<StoredIdempotentConsent[]>`
        SELECT "id", "action"::text AS "action", "provider", "model",
               "purposeVersion", "noticeVersion", "consentTextVersion",
               "retentionDisclosureVersion", "occurredAt"
          FROM "SearchProcessingConsent"
         WHERE "queryId" = ${input.queryId}
           AND "idempotencyDigest" = decode(${digestHex}, 'hex')
         LIMIT 1`;
      const replay = replayRows[0];
      const grant = grantFor(input.decision);
      if (replay) {
        const exact =
          replay.action === input.decision.action &&
          replay.provider === grant.provider &&
          replay.model === grant.model &&
          replay.purposeVersion === grant.purposeVersion &&
          replay.noticeVersion === grant.noticeVersion &&
          replay.consentTextVersion === grant.consentTextVersion &&
          replay.retentionDisclosureVersion ===
            grant.retentionDisclosureVersion;
        if (!exact) throw new Error("IMAGE_SEARCH_IDEMPOTENCY_KEY_REUSED");
        return { ...replay, replayed: true } as const;
      }
      const latest = await transaction.searchProcessingConsent.findFirst({
        where: { queryId: input.queryId },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });
      const created = await transaction.searchProcessingConsent.create({
        data: {
          id: randomUUID(),
          queryId: input.queryId,
          accountId: input.accountId,
          actorClass: input.actorClass,
          action: input.decision.action,
          supersedesConsentId: latest?.id,
          provider: grant.provider,
          interpreterClass: "EXTERNAL_OPENAI",
          model: grant.model,
          purposeVersion: grant.purposeVersion,
          noticeVersion: grant.noticeVersion,
          consentTextVersion: grant.consentTextVersion,
          retentionDisclosureVersion: grant.retentionDisclosureVersion,
          idempotencyDigest: Buffer.from(input.idempotencyDigest),
          occurredAt: input.now,
        },
        select: { id: true, action: true, occurredAt: true },
      });
      return { ...created, replayed: false } as const;
    });
  }
}
