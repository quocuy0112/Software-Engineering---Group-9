import "server-only";
import { prisma } from "@/backend/database/prisma";
import { calculationMetadata } from "@/backend/admin/dashboard/dashboard-definition";
const priorityOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2 } as const;
export class PrismaModerationRepository {
  async list(input: {
    page: number;
    perPage: number;
    filter: Record<string, unknown>;
  }) {
    const now = new Date();
    const minimumAgeHours =
      typeof input.filter.age === "string" ||
      typeof input.filter.age === "number"
        ? Number(input.filter.age)
        : Number.NaN;
    const where = {
      ...(typeof input.filter.targetType === "string"
        ? { targetType: input.filter.targetType as never }
        : {}),
      ...(typeof input.filter.category === "string"
        ? { category: input.filter.category as never }
        : {}),
      ...(typeof input.filter.priority === "string"
        ? { priority: input.filter.priority as never }
        : {}),
      ...(typeof input.filter.state === "string"
        ? { state: input.filter.state as never }
        : {}),
      ...(typeof input.filter.company === "string"
        ? { companyReference: input.filter.company }
        : {}),
      ...(Number.isFinite(minimumAgeHours) && minimumAgeHours >= 0
        ? {
            createdAt: {
              lte: new Date(now.getTime() - minimumAgeHours * 60 * 60_000),
            },
          }
        : {}),
      ...(input.filter.assigneeId === "UNASSIGNED"
        ? { assignedAdminUserId: null }
        : typeof input.filter.assigneeId === "string" &&
            input.filter.assigneeId !== "ANY"
          ? { assignedAdminUserId: input.filter.assigneeId }
          : {}),
    };
    const rows = await prisma.moderationReport.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    rows.sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    const total = rows.length;
    const page = rows.slice(
      (input.page - 1) * input.perPage,
      input.page * input.perPage,
    );
    return {
      data: page.map((row) => ({
        id: row.id,
        reporterAccountId: row.reporterUserId,
        targetType: row.targetType,
        targetReference: row.targetReference,
        companyReference: row.companyReference,
        jobReference: row.jobReference,
        applicationReference: row.applicationReference,
        category: row.category,
        state: row.state,
        priority: row.priority,
        assignedAdministratorId: row.assignedAdminUserId,
        createdAt: row.createdAt.toISOString(),
        version: row.version,
      })),
      total,
      ...calculationMetadata(now),
    };
  }
  async detail(id: string) {
    const row = await prisma.moderationReport.findUnique({
      where: { id },
      include: {
        history: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] },
        notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    return row
      ? {
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          terminalAt: row.terminalAt?.toISOString() ?? null,
        }
      : null;
  }
}
