import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  authenticationAuditEventSchema,
  type AuthenticationAuditEvent,
} from "@/backend/audit/events";
import { auditTargetReference } from "@/backend/image-search/telemetry";
import { randomUUID } from "node:crypto";

type AuditClient = Pick<typeof prisma, "auditEvent"> | Prisma.TransactionClient;

export class PrismaAuditRepository {
  constructor(private readonly db: AuditClient = prisma) {}

  private validated(input: AuthenticationAuditEvent) {
    // The strict event/context schemas are the persistence allowlist. Never
    // pass caller-owned request/provider objects directly to Prisma.
    return authenticationAuditEventSchema.parse(input);
  }

  async append(input: AuthenticationAuditEvent): Promise<string> {
    const event = this.validated(input);
    const created = await this.db.auditEvent.create({ data: event });
    return created.id;
  }

  async appendIdempotent(
    id: string,
    input: AuthenticationAuditEvent,
  ): Promise<string> {
    const event = this.validated(input);
    try {
      const created = await this.db.auditEvent.create({
        data: { id, ...event },
      });
      return created.id;
    } catch (error) {
      const existing = await this.db.auditEvent.findUnique({
        where: { id },
        select: { id: true },
      });
      if (existing) return existing.id;
      throw error;
    }
  }
}

export async function appendImageSearchAudit(input: {
  action:
    | "image_search.admitted"
    | "image_search.denied"
    | "image_search.stage_completed"
    | "image_search.stage_failed"
    | "image_search.consent_granted"
    | "image_search.consent_revoked"
    | "image_search.consumed"
    | "image_search.cancelled"
    | "image_search.expired"
    | "image_search.content_scrubbed"
    | "image_search.cleanup_completed"
    | "image_search.cleanup_failed"
    | "image_search.reconciled";
  queryId: string;
  actorClass: "VISITOR" | "AUTHENTICATED" | "SYSTEM";
  accountId?: string | null;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  context?: AuthenticationAuditEvent["context"];
  occurredAt: Date;
}) {
  const key = Buffer.from(
    process.env.IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1 ?? "",
    "base64",
  );
  if (key.byteLength !== 32) return;
  await new PrismaAuditRepository().append({
    occurredAt: input.occurredAt,
    actorType:
      input.actorClass === "SYSTEM"
        ? "system"
        : input.actorClass === "AUTHENTICATED"
          ? "user"
          : "anonymous",
    actorUserId: input.accountId ?? null,
    actorSessionId: null,
    action: input.action,
    targetType: "image_search",
    targetId: auditTargetReference({
      purpose: "JOB_IMAGE_SEARCH",
      targetId: input.queryId,
      key,
    }),
    result: input.result,
    correlationId: randomUUID(),
    context: {
      purpose: "JOB_IMAGE_SEARCH",
      actorClass: input.actorClass,
      ...input.context,
    },
  });
}
