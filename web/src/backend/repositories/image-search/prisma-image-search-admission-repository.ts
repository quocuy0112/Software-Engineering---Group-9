import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import type { CreateImageSearchRequest } from "@/shared/contracts/jobs/image-search";

const WINDOW_MS = 60 * 60_000;
const EVENT_RETENTION_MS = 65 * 60_000;
const QUERY_RETENTION_MS = 15 * 60_000;

type Subject = Readonly<{
  kind: "SOURCE_IP" | "BROWSER" | "ACCOUNT";
  digest: Uint8Array;
}>;

export type ImageSearchAdmissionInput = Readonly<{
  actor:
    | { kind: "AUTHENTICATED"; accountId: string; accountDigest: Uint8Array }
    | {
        kind: "VISITOR";
        browserDigest: Uint8Array;
        sourceIpDigest: Uint8Array;
        capability: string;
        capabilityHmacKey: Uint8Array;
        capabilityKeyVersion: number;
      };
  metadata: CreateImageSearchRequest;
  idempotencyDigest: Uint8Array;
  bindingDigest: Uint8Array;
  now: Date;
}>;

function advisoryKey(digest: Uint8Array): bigint {
  const bytes = Buffer.from(digest);
  const value = bytes.readBigUInt64BE(0);
  return value > BigInt("9223372036854775807")
    ? BigInt.asIntN(64, value)
    : BigInt(value);
}

function sameDigest(left: Uint8Array, right: Uint8Array) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

type ReplayRow = Readonly<{
  id: string;
  actorClass: "VISITOR" | "AUTHENTICATED";
  admittedAt: Date;
  expiresAt: Date;
  createBindingDigestHex: string;
}>;

function subjects(input: ImageSearchAdmissionInput): Subject[] {
  return input.actor.kind === "AUTHENTICATED"
    ? [{ kind: "ACCOUNT", digest: input.actor.accountDigest }]
    : [
        { kind: "SOURCE_IP", digest: input.actor.sourceIpDigest },
        { kind: "BROWSER", digest: input.actor.browserDigest },
      ];
}

export class PrismaImageSearchAdmissionRepository {
  async admit(input: ImageSearchAdmissionInput): Promise<
    | Readonly<{
        kind: "ADMITTED";
        replay: boolean;
        query: Readonly<{
          id: string;
          actorClass: "VISITOR" | "AUTHENTICATED";
          admittedAt: Date;
          expiresAt: Date;
        }>;
      }>
    | Readonly<{ kind: "LIMITED"; retryAt: Date }>
  > {
    return prisma.$transaction(async (transaction) => {
      const orderedSubjects = subjects(input).sort((left, right) =>
        Buffer.compare(Buffer.from(left.digest), Buffer.from(right.digest)),
      );
      for (const subject of orderedSubjects)
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryKey(subject.digest)})`;

      const idempotencyHex = Buffer.from(input.idempotencyDigest).toString(
        "hex",
      );
      const replayRows =
        input.actor.kind === "AUTHENTICATED"
          ? await transaction.$queryRaw<ReplayRow[]>`
              SELECT "id", "actorClass", "admittedAt", "expiresAt",
                     encode("createBindingDigest", 'hex') AS "createBindingDigestHex"
                FROM "SearchImageQuery"
               WHERE "accountId" = ${input.actor.accountId}
                 AND "idempotencyDigest" = decode(${idempotencyHex}, 'hex')
               LIMIT 1`
          : await transaction.$queryRaw<ReplayRow[]>`
              SELECT "id", "actorClass", "admittedAt", "expiresAt",
                     encode("createBindingDigest", 'hex') AS "createBindingDigestHex"
                FROM "SearchImageQuery"
               WHERE "visitorSubjectDigest" = decode(${Buffer.from(input.actor.browserDigest).toString("hex")}, 'hex')
                 AND "idempotencyDigest" = decode(${idempotencyHex}, 'hex')
               LIMIT 1`;
      const replay = replayRows[0];
      if (replay) {
        if (
          !sameDigest(
            Buffer.from(replay.createBindingDigestHex, "hex"),
            input.bindingDigest,
          )
        )
          throw new Error("IMAGE_SEARCH_IDEMPOTENCY_KEY_REUSED");
        return {
          kind: "ADMITTED" as const,
          replay: true,
          query: {
            id: replay.id,
            actorClass: replay.actorClass,
            admittedAt: replay.admittedAt,
            expiresAt: replay.expiresAt,
          },
        };
      }

      const windowStart = new Date(input.now.getTime() - WINDOW_MS);
      let retryAt: Date | null = null;
      for (const subject of orderedSubjects) {
        const limit = subject.kind === "ACCOUNT" ? 10 : 3;
        const events = await transaction.imageSearchAdmissionEvent.findMany({
          where: {
            subjectKind: subject.kind,
            subjectDigest: Buffer.from(subject.digest),
            admittedAt: { gte: windowStart, lt: input.now },
          },
          orderBy: { admittedAt: "asc" },
          select: { admittedAt: true },
        });
        if (events.length >= limit) {
          const candidate = new Date(
            events[events.length - limit]!.admittedAt.getTime() + WINDOW_MS,
          );
          if (!retryAt || candidate > retryAt) retryAt = candidate;
        }
      }
      if (retryAt) return { kind: "LIMITED" as const, retryAt };

      const queryId = randomUUID();
      const capabilityDigest =
        input.actor.kind === "VISITOR"
          ? createHmac("sha256", input.actor.capabilityHmacKey)
              .update(
                `image-search-capability-v1:${queryId}:${input.actor.capability}`,
                "utf8",
              )
              .digest()
          : null;
      const deadline = new Date(input.now.getTime() + QUERY_RETENTION_MS);
      const query = await transaction.searchImageQuery.create({
        data: {
          id: queryId,
          actorClass:
            input.actor.kind === "AUTHENTICATED" ? "AUTHENTICATED" : "VISITOR",
          accountId:
            input.actor.kind === "AUTHENTICATED" ? input.actor.accountId : null,
          visitorSubjectDigest:
            input.actor.kind === "VISITOR"
              ? Buffer.from(input.actor.browserDigest)
              : null,
          visitorCapabilityDigest:
            input.actor.kind === "VISITOR" ? capabilityDigest : null,
          capabilityKeyVersion:
            input.actor.kind === "VISITOR"
              ? input.actor.capabilityKeyVersion
              : null,
          status: "AWAITING_CONTENT",
          interpreterClass: input.metadata.interpreterClass,
          declaredExtension: input.metadata.extension,
          declaredMediaType: input.metadata.mediaType,
          declaredBytes: input.metadata.bytes,
          idempotencyDigest: Buffer.from(input.idempotencyDigest),
          createBindingDigest: Buffer.from(input.bindingDigest),
          admittedAt: input.now,
          expiresAt: deadline,
          deleteBy: deadline,
          createdAt: input.now,
        },
        select: {
          id: true,
          actorClass: true,
          admittedAt: true,
          expiresAt: true,
        },
      });
      await transaction.imageSearchAdmissionEvent.createMany({
        data: orderedSubjects.map((subject) => ({
          id: randomUUID(),
          queryId,
          subjectKind: subject.kind,
          subjectDigest: Buffer.from(subject.digest),
          keyVersion: 1,
          admittedAt: input.now,
          expiresAt: new Date(input.now.getTime() + EVENT_RETENTION_MS),
        })),
      });
      if (input.metadata.consent) {
        await transaction.searchProcessingConsent.create({
          data: {
            id: randomUUID(),
            queryId,
            accountId:
              input.actor.kind === "AUTHENTICATED"
                ? input.actor.accountId
                : null,
            actorClass: query.actorClass,
            action: "GRANTED",
            provider: input.metadata.consent.provider,
            interpreterClass: "EXTERNAL_OPENAI",
            model: input.metadata.consent.model,
            purposeVersion: input.metadata.consent.purposeVersion,
            noticeVersion: input.metadata.consent.noticeVersion,
            consentTextVersion: input.metadata.consent.consentTextVersion,
            retentionDisclosureVersion:
              input.metadata.consent.retentionDisclosureVersion,
            occurredAt: input.now,
          },
        });
      }
      return { kind: "ADMITTED" as const, replay: false, query };
    });
  }
}
