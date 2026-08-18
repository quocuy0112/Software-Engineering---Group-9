import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";

function digest(value: string | null) {
  return value ? createHash("sha256").update(value).digest("hex") : undefined;
}

export async function recordAdminAccessDenied(
  request: Request,
  reason: string,
  actorUserId?: string,
) {
  return new AuditWriter(prisma).append({
    occurredAt: new Date(),
    actorType: actorUserId ? "user" : "anonymous",
    actorUserId,
    action: "admin.access_denied",
    targetType: "administrator_grant",
    result: "DENIED",
    correlationId: randomUUID(),
    ipPrefixDigest: digest(request.headers.get("x-forwarded-for")),
    userAgentFamily: request.headers.get("user-agent")?.slice(0, 80),
    context: { reason: reason.slice(0, 160) },
  });
}

export async function recordCompanyDetailViewed(input: {
  companyId: string;
  actorUserId: string;
  actorSessionId: string;
}) {
  return new AuditWriter(prisma).append({
    occurredAt: new Date(),
    actorType: "user",
    actorUserId: input.actorUserId,
    actorSessionId: input.actorSessionId,
    action: "admin.company_detail_viewed",
    targetType: "company",
    targetId: input.companyId,
    result: "SUCCESS",
    correlationId: randomUUID(),
    context: {},
  });
}
