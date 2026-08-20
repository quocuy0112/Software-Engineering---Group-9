import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { createInAppNotification } from "@/backend/notifications/notification-service";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { requireActiveCompanyOwner } from "./company-team-authorization";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const tokenProtector = new TokenProtector();
type ManagedRole = "HR_MANAGER" | "RECRUITER";
type MemberAction = "role" | "suspend" | "restore" | "remove";
type InvitationOutcome = "ACCEPTED" | "DECLINED";

export class CompanyTeamCommandError extends Error {
  constructor(readonly code: string) { super(code); }
}

export class CompanyTeamService {
  async list(userId: string) {
    const owner = await requireActiveCompanyOwner(userId);
    const now = new Date();
    await prisma.companyInvitation.updateMany({ where: { companyId: owner.companyId, state: "PENDING", expiresAt: { lte: now } }, data: { state: "EXPIRED", version: { increment: 1 } } });
    const [members, invitations, activities] = await Promise.all([
      prisma.companyMembership.findMany({ where: { companyId: owner.companyId }, select: { id: true, role: true, status: true, stateChangedAt: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.companyInvitation.findMany({ where: { companyId: owner.companyId, state: "PENDING" }, select: { id: true, normalizedEmail: true, role: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      prisma.companyTeamActivity.findMany({ where: { companyId: owner.companyId }, select: { id: true, kind: true, actorUserId: true, targetEmail: true, role: true, occurredAt: true }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 50 }),
    ]);
    const actorIds = [...new Set(activities.flatMap((activity) => activity.actorUserId ? [activity.actorUserId] : []))];
    const actors = actorIds.length ? await prisma.userAccount.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return { members, invitations, activities: activities.map((activity) => ({ ...activity, actor: activity.actorUserId ? actorById.get(activity.actorUserId) ?? null : null })) };
  }

  async invite(userId: string, email: string, role: ManagedRole) {
    const owner = await requireActiveCompanyOwner(userId);
    const normalizedEmail = email.trim().toLowerCase();
    const target = await prisma.userAccount.findUnique({ where: { normalizedEmail }, select: { id: true, state: true } });
    if (!target || target.state !== "ACTIVE") throw new CompanyTeamCommandError("RECIPIENT_UNAVAILABLE");
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const invitation = await prisma.$transaction(async (tx) => {
      await tx.companyInvitation.updateMany({ where: { companyId: owner.companyId, normalizedEmail, state: "PENDING", expiresAt: { lte: now } }, data: { state: "EXPIRED", version: { increment: 1 } } });
      const membership = await tx.companyMembership.findUnique({ where: { companyId_userId: { companyId: owner.companyId, userId: target.id } }, select: { status: true } });
      if (membership && membership.status !== "REMOVED") throw new CompanyTeamCommandError("MEMBERSHIP_EXISTS");
      if (await tx.companyInvitation.findFirst({ where: { companyId: owner.companyId, normalizedEmail, state: "PENDING" }, select: { id: true } })) throw new CompanyTeamCommandError("INVITATION_EXISTS");
      const invitation = await tx.companyInvitation.create({ data: { companyId: owner.companyId, normalizedEmail, role, tokenDigest: digest(token), invitedByUserId: userId, expiresAt: new Date(now.getTime() + invitationLifetimeMs) }, select: { id: true, expiresAt: true } });
      await new PrismaOutboxRepository(tx).enqueueIdempotent({
        kind: "COMPANY_INVITATION",
        userId: target.id,
        recipientRef: target.id,
        templateVersion: "company-invitation.v1",
        payloadRef: {
          companyName: owner.company.displayName,
          role,
          protectedToken: tokenProtector.seal(token),
        },
        idempotencyKey: `company-invitation-email:${invitation.id}`,
      });
      await createInAppNotification(tx, {
        recipientUserId: target.id,
        kind: "COMPANY_INVITATION_RECEIVED",
        deduplicationKey: `company-invitation-notification:${invitation.id}:${target.id}`,
        correlationId: invitation.id,
        occurredAt: now,
        contextType: "COMPANY_INVITATION",
        contextId: invitation.id,
        variables: { companyName: owner.company.displayName },
      });
      await tx.companyTeamActivity.create({ data: { companyId: owner.companyId, kind: "INVITED", actorUserId: userId, targetEmail: normalizedEmail, role, occurredAt: now } });
      return invitation;
    });
    return invitation;
  }

  async preview(userId: string, token: string) {
    const now = new Date();
    const account = await prisma.userAccount.findUnique({ where: { id: userId }, select: { email: true, state: true } });
    const invitation = await prisma.companyInvitation.findUnique({ where: { tokenDigest: digest(token) }, include: { company: { select: { displayName: true } } } });
    if (!account || account.state !== "ACTIVE" || !invitation || invitation.state !== "PENDING" || invitation.expiresAt <= now || invitation.normalizedEmail !== account.email.trim().toLowerCase()) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
    return { companyName: invitation.company.displayName, role: invitation.role, expiresAt: invitation.expiresAt };
  }

  async accept(userId: string, token: string) {
    await this.decide(userId, token, "ACCEPTED");
  }

  async decline(userId: string, token: string) {
    await this.decide(userId, token, "DECLINED");
  }

  private async decide(userId: string, token: string, outcome: InvitationOutcome) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const account = await tx.userAccount.findUnique({ where: { id: userId }, select: { email: true, state: true } });
      if (!account || account.state !== "ACTIVE") throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      const normalizedEmail = account.email.trim().toLowerCase();
      const invitation = await tx.companyInvitation.findUnique({ where: { tokenDigest: digest(token) }, include: { company: { select: { displayName: true } } } });
      if (!invitation || invitation.state !== "PENDING" || invitation.expiresAt <= now || invitation.normalizedEmail !== normalizedEmail) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      const claimed = await tx.companyInvitation.updateMany({ where: { id: invitation.id, state: "PENDING", version: invitation.version }, data: outcome === "ACCEPTED" ? { state: "ACCEPTED", acceptedByUserId: userId, acceptedAt: now, version: { increment: 1 } } : { state: "DECLINED", declinedByUserId: userId, declinedAt: now, version: { increment: 1 } } });
      if (claimed.count !== 1) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      await this.recordInvitationResponse(tx, invitation, account.email, userId, outcome, now);
      if (outcome === "DECLINED") return;
      const existing = await tx.companyMembership.findUnique({ where: { companyId_userId: { companyId: invitation.companyId, userId } } });
      const membership = existing
        ? await tx.companyMembership.update({ where: { id: existing.id }, data: { role: invitation.role, priorApprovedRole: invitation.role, status: "ACTIVE", removedAt: null, stateChangedAt: now, version: { increment: 1 } } })
        : await tx.companyMembership.create({ data: { companyId: invitation.companyId, userId, role: invitation.role, priorApprovedRole: invitation.role, status: "ACTIVE", stateChangedAt: now } });
      await tx.companyMembershipHistory.create({ data: { membershipId: membership.id, actorUserId: userId, priorStatus: existing?.status ?? "REMOVED", resultingStatus: "ACTIVE", priorRole: existing?.role ?? invitation.role, resultingRole: invitation.role, version: membership.version, correlationId: invitation.id, occurredAt: now } });
    });
  }

  private async recordInvitationResponse(tx: Parameters<typeof createInAppNotification>[0], invitation: { id: string; companyId: string; role: string; invitedByUserId: string; company: { displayName: string } }, recipientEmail: string, actorUserId: string, outcome: InvitationOutcome, occurredAt: Date) {
    const notificationKind = outcome === "ACCEPTED" ? "COMPANY_INVITATION_ACCEPTED" : "COMPANY_INVITATION_DECLINED" as const;
    await createInAppNotification(tx, { recipientUserId: invitation.invitedByUserId, kind: notificationKind, deduplicationKey: `company-invitation-response-notification:${invitation.id}`, correlationId: invitation.id, occurredAt, contextType: "COMPANY_INVITATION", contextId: invitation.id, variables: { companyName: invitation.company.displayName, targetEmail: recipientEmail, recipientRole: "RECRUITER" } });
    await new PrismaOutboxRepository(tx).enqueueIdempotent({ kind: "COMPANY_INVITATION_RESPONSE", userId: invitation.invitedByUserId, recipientRef: invitation.invitedByUserId, templateVersion: "company-invitation-response.v1", payloadRef: { companyName: invitation.company.displayName, recipientEmail, outcome, role: invitation.role }, idempotencyKey: `company-invitation-response-email:${invitation.id}` });
    await tx.companyTeamActivity.create({ data: { companyId: invitation.companyId, kind: outcome, actorUserId, targetEmail: recipientEmail, role: invitation.role as ManagedRole, occurredAt } });
  }

  async revoke(userId: string, invitationId: string) {
    const owner = await requireActiveCompanyOwner(userId);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.companyInvitation.findFirst({ where: { id: invitationId, companyId: owner.companyId, state: "PENDING" } });
      if (!invitation) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      const changed = await tx.companyInvitation.updateMany({ where: { id: invitation.id, state: "PENDING", version: invitation.version }, data: { state: "REVOKED", revokedAt: now, version: { increment: 1 } } });
      if (changed.count !== 1) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      await tx.companyTeamActivity.create({ data: { companyId: owner.companyId, kind: "REVOKED", actorUserId: userId, targetEmail: invitation.normalizedEmail, role: invitation.role, occurredAt: now } });
    });
  }

  async change(userId: string, membershipId: string, action: MemberAction, nextRole?: ManagedRole) {
    const owner = await requireActiveCompanyOwner(userId);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const member = await tx.companyMembership.findFirst({ where: { id: membershipId, companyId: owner.companyId }, include: { user: { select: { email: true } } } });
      if (!member || member.role === "OWNER" || member.status === "REMOVED") throw new CompanyTeamCommandError("MEMBERSHIP_UNAVAILABLE");
      if (action === "role" && !nextRole) throw new CompanyTeamCommandError("ROLE_REQUIRED");
      if ((action === "suspend" && member.status !== "ACTIVE") || (action === "restore" && member.status !== "SUSPENDED")) throw new CompanyTeamCommandError("INVALID_MEMBERSHIP_STATE");
      const status = action === "suspend" ? "SUSPENDED" : action === "restore" ? "ACTIVE" : action === "remove" ? "REMOVED" : member.status;
      const role = action === "role" ? nextRole! : member.role;
      const updated = await tx.companyMembership.update({ where: { id: member.id }, data: { role, priorApprovedRole: role, status, removedAt: status === "REMOVED" ? now : null, stateChangedAt: now, version: { increment: 1 } } });
      await tx.companyMembershipHistory.create({ data: { membershipId: updated.id, actorUserId: userId, priorStatus: member.status, resultingStatus: status, priorRole: member.role, resultingRole: role, version: updated.version, correlationId: `${action}:${updated.id}:${updated.version}`, occurredAt: now } });
      await tx.companyTeamActivity.create({ data: { companyId: owner.companyId, kind: action === "role" ? "ROLE_CHANGED" : action === "suspend" ? "SUSPENDED" : action === "restore" ? "RESTORED" : "REMOVED", actorUserId: userId, targetEmail: member.user.email, role, occurredAt: now } });
    });
  }
}
