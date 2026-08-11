import "server-only";
import { prisma } from "@/backend/database/prisma";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";

export class PrismaAdminMembershipRepository {
  async companies(input: { page: number; perPage: number; filter: Record<string, unknown> }) {
    const now = new Date(); const q = typeof input.filter.q === "string" ? input.filter.q.trim() : "";
    const where = q ? { OR: [{ id: q }, { legalName: { contains: q, mode: "insensitive" as const } }, { displayName: { contains: q, mode: "insensitive" as const } }] } : {};
    const [rows, total] = await Promise.all([prisma.company.findMany({ where, select: { id: true, legalName: true, verificationState: true }, skip: (input.page - 1) * input.perPage, take: input.perPage, orderBy: [{ legalName: "asc" }, { id: "asc" }] }), prisma.company.count({ where })]);
    return { data: rows, total, ...calculationMetadata(now) };
  }
  async list(input: { page: number; perPage: number; filter: Record<string, unknown> }) {
    const now = new Date(); const where = {
      ...(typeof input.filter.companyId === "string" ? { companyId: input.filter.companyId } : {}),
      ...(typeof input.filter.accountId === "string" ? { userId: input.filter.accountId } : {}),
      ...(typeof input.filter.role === "string" ? { role: input.filter.role as "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER" } : {}),
      ...(typeof input.filter.state === "string" ? { status: input.filter.state as "ACTIVE" | "SUSPENDED" | "REMOVED" } : {}),
    };
    const [rows, total] = await Promise.all([prisma.companyMembership.findMany({ where, include: { company: { select: { id: true, legalName: true, verificationState: true } }, user: { select: { name: true } } }, skip: (input.page - 1) * input.perPage, take: input.perPage, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }), prisma.companyMembership.count({ where })]);
    return { data: rows.map((row) => ({ id: row.id, company: row.company, companyId: row.companyId, accountId: row.userId, accountDisplayName: row.user.name, role: row.role, state: row.status, priorApprovedRole: row.priorApprovedRole ?? row.role, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })), total, ...calculationMetadata(now) };
  }
  async one(id: string) { const row = await prisma.companyMembership.findUnique({ where: { id }, include: { company: { select: { id: true, legalName: true, verificationState: true } }, user: { select: { name: true } }, history: { orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 25 } } }); return row ? { id: row.id, company: row.company, companyId: row.companyId, accountId: row.userId, accountDisplayName: row.user.name, role: row.role, state: row.status, priorApprovedRole: row.priorApprovedRole ?? row.role, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), history: row.history } : null; }
}
