import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { requireActiveCompanyOwner } from "./company-team-authorization";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
type ManagedRole = "HR_MANAGER" | "RECRUITER";
type MemberAction = "role" | "suspend" | "restore" | "remove";

export class CompanyTeamCommandError extends Error {
  constructor(readonly code: string) { super(code); }
}

export class CompanyTeamService {
  async list(userId: string) {
    const owner = await requireActiveCompanyOwner(userId);
    const now = new Date();
    await prisma.companyInvitation.updateMany({ where: { companyId: owner.companyId, state: "PENDING", expiresAt: { lte: now } }, data: { state: "EXPIRED", version: { increment: 1 } } });
    const [members, invitations] = await Promise.all([
      prisma.companyMembership.findMany({ where: { companyId: owner.companyId }, select: { id: true, role: true, status: true, stateChangedAt: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.companyInvitation.findMany({ where: { companyId: owner.companyId, state: "PENDING" }, select: { id: true, normalizedEmail: true, role: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    return { members, invitations };
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
      return tx.companyInvitation.create({ data: { companyId: owner.companyId, normalizedEmail, role, tokenDigest: digest(token), invitedByUserId: userId, expiresAt: new Date(now.getTime() + invitationLifetimeMs) }, select: { id: true, expiresAt: true } });
    });
    // The caller is responsible for delivering this one-time value; it is never persisted or logged.
    return { ...invitation, acceptanceToken: token };
  }

  async accept(userId: string, token: string) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const account = await tx.userAccount.findUnique({ where: { id: userId }, select: { email: true, state: true } });
      if (!account || account.state !== "ACTIVE") throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      const normalizedEmail = account.email.trim().toLowerCase();
      const invitation = await tx.companyInvitation.findUnique({ where: { tokenDigest: digest(token) } });
      if (!invitation || invitation.state !== "PENDING" || invitation.expiresAt <= now || invitation.normalizedEmail !== normalizedEmail) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      const claimed = await tx.companyInvitation.updateMany({ where: { id: invitation.id, state: "PENDING", version: invitation.version }, data: { state: "ACCEPTED", acceptedByUserId: userId, acceptedAt: now, version: { increment: 1 } } });
      if (claimed.count !== 1) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
      const existing = await tx.companyMembership.findUnique({ where: { companyId_userId: { companyId: invitation.companyId, userId } } });
      const membership = existing
        ? await tx.companyMembership.update({ where: { id: existing.id }, data: { role: invitation.role, priorApprovedRole: invitation.role, status: "ACTIVE", removedAt: null, stateChangedAt: now, version: { increment: 1 } } })
        : await tx.companyMembership.create({ data: { companyId: invitation.companyId, userId, role: invitation.role, priorApprovedRole: invitation.role, status: "ACTIVE", stateChangedAt: now } });
      await tx.companyMembershipHistory.create({ data: { membershipId: membership.id, actorUserId: userId, priorStatus: existing?.status ?? "REMOVED", resultingStatus: "ACTIVE", priorRole: existing?.role ?? invitation.role, resultingRole: invitation.role, version: membership.version, correlationId: invitation.id, occurredAt: now } });
    });
  }

  async revoke(userId: string, invitationId: string) {
    const owner = await requireActiveCompanyOwner(userId);
    const changed = await prisma.companyInvitation.updateMany({ where: { id: invitationId, companyId: owner.companyId, state: "PENDING" }, data: { state: "REVOKED", revokedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new CompanyTeamCommandError("INVITATION_UNAVAILABLE");
  }

  async change(userId: string, membershipId: string, action: MemberAction, nextRole?: ManagedRole) {
    const owner = await requireActiveCompanyOwner(userId);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const member = await tx.companyMembership.findFirst({ where: { id: membershipId, companyId: owner.companyId } });
      if (!member || member.role === "OWNER" || member.status === "REMOVED") throw new CompanyTeamCommandError("MEMBERSHIP_UNAVAILABLE");
      if (action === "role" && !nextRole) throw new CompanyTeamCommandError("ROLE_REQUIRED");
      if ((action === "suspend" && member.status !== "ACTIVE") || (action === "restore" && member.status !== "SUSPENDED")) throw new CompanyTeamCommandError("INVALID_MEMBERSHIP_STATE");
      const status = action === "suspend" ? "SUSPENDED" : action === "restore" ? "ACTIVE" : action === "remove" ? "REMOVED" : member.status;
      const role = action === "role" ? nextRole! : member.role;
      const updated = await tx.companyMembership.update({ where: { id: member.id }, data: { role, priorApprovedRole: role, status, removedAt: status === "REMOVED" ? now : null, stateChangedAt: now, version: { increment: 1 } } });
      await tx.companyMembershipHistory.create({ data: { membershipId: updated.id, actorUserId: userId, priorStatus: member.status, resultingStatus: status, priorRole: member.role, resultingRole: role, version: updated.version, correlationId: `${action}:${updated.id}:${updated.version}`, occurredAt: now } });
    });
  }
}
