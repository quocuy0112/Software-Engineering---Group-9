import { randomUUID } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { requireAccountRequest, accountErrorResponse, parseBoundedJson } from "@/backend/security/account-request-boundary";

const consentSchema = z.object({ shared: z.boolean(), expectedVersion: z.number().int().positive().optional() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const { applicationId } = await context.params;
    const input = await parseBoundedJson(request, consentSchema, 1024);
    const application = await prisma.jobApplication.findFirst({ where: { id: applicationId, candidateUserId: current.userId }, select: { id: true } });
    if (!application) return NextResponse.json({ code: "NOT_FOUND", message: "Application is not available." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const now = new Date();
    const existing = await prisma.jobApplicationContactConsent.findUnique({ where: { applicationId }, select: { version: true } });
    if (input.expectedVersion !== undefined && existing && existing.version !== input.expectedVersion) {
      return NextResponse.json({ code: "CONFLICT", message: "Contact sharing changed. Refresh and try again." }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }
    const consent = await prisma.jobApplicationContactConsent.upsert({
      where: { applicationId },
      create: { applicationId, sharedAt: input.shared ? now : null, withdrawnAt: input.shared ? null : now, version: 1 },
      update: { sharedAt: input.shared ? now : null, withdrawnAt: input.shared ? null : now, version: { increment: 1 } },
    });
    await new PrismaAuditRepository().append({ occurredAt: now, actorType: "user", actorUserId: current.userId, actorSessionId: current.sessionId, action: input.shared ? "application.contact_consent_granted" : "application.contact_consent_withdrawn", targetType: "application_contact_consent", targetId: applicationId, result: "SUCCESS", correlationId: randomUUID(), context: { targetVersion: consent.version, consentPresent: input.shared, consentRevoked: !input.shared } });
    return NextResponse.json({ shared: Boolean(consent.sharedAt && !consent.withdrawnAt), version: consent.version }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
