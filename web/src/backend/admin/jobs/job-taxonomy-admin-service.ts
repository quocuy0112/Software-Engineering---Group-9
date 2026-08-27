import "server-only";

import { prisma } from "@/backend/database/prisma";
import type { Prisma } from "@/backend/generated/prisma/client";
import type { AdminAuthority } from "@/backend/security/admin-request-boundary";
import {
  PrismaAdminCommandRepository,
  AdminCommandConflict,
} from "@/backend/repositories/admin/prisma-admin-command-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrivilegedRationaleService } from "@/backend/admin/rationales/privileged-rationale-service";
import { invalidateJobSearchTaxonomyCache } from "@/backend/services/jobs/job-search-taxonomy";
import { invalidateJobTaxonomyCache } from "@/backend/services/jobs/job-taxonomy-service";
import {
  jobTaxonomyCommandSchema,
  jobTaxonomyListQuerySchema,
} from "@/shared/contracts/admin/job-taxonomy";

const ADMIN_STATE_DEFINITION_VERSION = "admin-state-v2" as const;

type TaxonomyStatus = "ACTIVE" | "INACTIVE" | "REMOVED";
type AdminDb = typeof prisma | Prisma.TransactionClient;

function listWhere(input: {
  q?: string;
  status?: TaxonomyStatus;
  industryCode?: string;
}) {
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(input.industryCode
      ? {
          industry: {
            OR: [{ id: input.industryCode }, { code: input.industryCode }],
          },
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            { id: { contains: input.q, mode: "insensitive" as const } },
            { code: { contains: input.q, mode: "insensitive" as const } },
            { name: { contains: input.q, mode: "insensitive" as const } },
            {
              industry: {
                OR: [
                  {
                    code: { contains: input.q, mode: "insensitive" as const },
                  },
                  {
                    name: { contains: input.q, mode: "insensitive" as const },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };
}

function project(row: {
  id: string;
  industryId: string;
  code: string;
  name: string;
  status: TaxonomyStatus;
  sortOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  industry: {
    id: string;
    code: string;
    name: string;
    status: TaxonomyStatus;
  };
  _count: { jobPostings: number; resolvedProposals: number };
}) {
  return {
    id: row.id,
    kind: "SUBINDUSTRY" as const,
    industryId: row.industryId,
    industry: row.industry,
    code: row.code,
    name: row.name,
    status: row.status,
    sortOrder: row.sortOrder,
    version: row.version,
    jobCount: row._count.jobPostings,
    proposalCount: row._count.resolvedProposals,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const listArgs = {
  include: {
    industry: {
      select: { id: true, code: true, name: true, status: true },
    },
    _count: { select: { jobPostings: true, resolvedProposals: true } },
  },
} as const;

export class JobTaxonomyAdminService {
  private async assertActiveGrant(
    authority: AdminAuthority,
    db: AdminDb = prisma,
  ) {
    const grant = await db.platformAdministratorGrant.findFirst({
      where: {
        id: authority.grantId,
        userId: authority.userId,
        state: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        user: { state: "ACTIVE", deletedAt: null },
        sessionPolicy: {
          is: { designatedSessionId: authority.sessionId },
        },
      },
      select: { id: true },
    });
    if (!grant) throw new Error("ACTION_BLOCKED");
  }

  async list(authority: AdminAuthority, raw: unknown) {
    await this.assertActiveGrant(authority);
    const input = jobTaxonomyListQuerySchema.parse(raw);
    const where = listWhere(input);
    const [total, rows] = await Promise.all([
      prisma.jobSubIndustry.count({ where }),
      prisma.jobSubIndustry.findMany({
        ...listArgs,
        where,
        orderBy: [
          { industry: { sortOrder: "asc" } },
          { industry: { name: "asc" } },
          { sortOrder: "asc" },
          { name: "asc" },
          { id: "asc" },
        ],
        skip: (input.page - 1) * input.perPage,
        take: input.perPage,
      }),
    ]);
    return {
      data: rows.map(project),
      total,
      meta: {
        calculatedAt: new Date().toISOString(),
        stateDefinitionVersion: ADMIN_STATE_DEFINITION_VERSION,
      },
    };
  }

  async detail(authority: AdminAuthority, id: string) {
    await this.assertActiveGrant(authority);
    const row = await prisma.jobSubIndustry.findUnique({
      ...listArgs,
      where: { id },
    });
    if (!row) throw new Error("TARGET_UNAVAILABLE");
    return project(row);
  }

  async command(
    authority: AdminAuthority,
    id: string,
    raw: unknown,
    expectedVersion: number,
    idempotencyKey: string,
  ) {
    const command = jobTaxonomyCommandSchema.parse(raw);
    await this.assertActiveGrant(authority);
    const result = await new PrismaAdminCommandRepository().execute(
      {
        actorUserId: authority.userId,
        actorSessionId: authority.sessionId,
        grantId: authority.grantId,
        commandKind: `JOB_TAXONOMY_${command.command}`,
        targetReference: id,
        idempotencyKey,
        normalizedBody: { id, expectedVersion, command },
      },
      async (tx, correlationId) => {
        await this.assertActiveGrant(authority, tx);
        const row = await tx.jobSubIndustry.findUnique({
          where: { id },
          include: {
            industry: { select: { id: true, code: true } },
          },
        });
        if (!row) throw new Error("TARGET_UNAVAILABLE");
        if (row.version !== expectedVersion)
          throw new AdminCommandConflict("STALE_CONFLICT", row.version);

        const currentStatus = row.status as TaxonomyStatus;
        const transition =
          command.command === "DEACTIVATE"
            ? { from: ["ACTIVE"] as const, to: "INACTIVE" as const }
            : command.command === "REMOVE"
              ? {
                  from: ["ACTIVE", "INACTIVE"] as const,
                  to: "REMOVED" as const,
                }
              : { from: ["INACTIVE"] as const, to: "ACTIVE" as const };
        if (
          !(transition.from as readonly TaxonomyStatus[]).includes(
            currentStatus,
          )
        )
          throw new Error("INVALID_STATE");

        const nextStatus: TaxonomyStatus = transition.to;
        const now = new Date();
        const updated = await tx.jobSubIndustry.updateMany({
          where: { id, version: expectedVersion, status: currentStatus },
          data: {
            status: nextStatus,
            version: { increment: 1 },
            updatedAt: now,
          },
        });
        if (updated.count !== 1)
          throw new AdminCommandConflict("STALE_CONFLICT");

        await tx.jobIndustry.update({
          where: { id: row.industryId },
          data: { version: { increment: 1 }, updatedAt: now },
        });

        await new PrismaAuditRepository(tx).append({
          occurredAt: now,
          actorType: "user",
          actorUserId: authority.userId,
          actorSessionId: authority.sessionId,
          action:
            command.command === "DEACTIVATE"
              ? "admin.job_taxonomy_deactivated"
              : command.command === "REMOVE"
                ? "admin.job_taxonomy_removed"
                : "admin.job_taxonomy_reactivated",
          targetType: "privileged_action",
          targetId: id,
          result: "SUCCESS",
          correlationId,
          context: {
            reasonCategory: command.reasonCategory,
            priorState: currentStatus,
            resultingState: nextStatus,
            targetVersion: expectedVersion + 1,
            outcome: "TAXONOMY_STATUS_CHANGED",
          },
        });
        await new PrivilegedRationaleService().create(tx, {
          correlationId,
          explanation: command.explanation,
          actionAt: now,
        });

        return {
          id,
          code: row.code,
          name: row.name,
          status: nextStatus,
          version: expectedVersion + 1,
          industryCode: row.industry.code,
          statusChangedAt: now.toISOString(),
        };
      },
    );
    // Invalidate only after the command transaction has committed. Otherwise
    // a concurrent reader could refill the cache with the pre-command state.
    invalidateJobTaxonomyCache();
    invalidateJobSearchTaxonomyCache();
    // Job Posting management responses include the active taxonomy. Clear
    // that projection as well so a subsequent recruiter request cannot reuse
    // the old sub-industry list.
    await import("@/backend/services/jobs/recruiter-job-posting-data")
      .then(({ invalidateRecruiterJobCatalogueCache }) =>
        invalidateRecruiterJobCatalogueCache(),
      )
      .catch(() => undefined);
    return result;
  }
}
