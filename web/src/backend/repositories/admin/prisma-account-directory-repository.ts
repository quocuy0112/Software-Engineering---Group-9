import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

type Client = typeof prisma | Prisma.TransactionClient;
type DirectoryInput = {
  q?: string;
  type: "ALL" | "CANDIDATE" | "RECRUITER";
  status: "ALL" | "ACTIVE" | "SUSPENDED";
  registeredFrom?: string;
  registeredTo?: string;
  page: number;
  pageSize: 25 | 50 | 100;
};

const recruiterAuthorityWhere = {
  status: "ACTIVE" as const,
  company: { verificationState: "ACTIVE" as const },
};

function rangeStart(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function rangeEndExclusive(value?: string) {
  if (!value) return undefined;
  const end = new Date(`${value}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.normalize("NFC").split("@");
  const chars = Array.from(local);
  return `${chars.length < 2 ? "***" : `${chars[0]}***`}@${domain}`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class PrismaAccountDirectoryRepository {
  constructor(private readonly db: Client = prisma) {}

  private where(input: DirectoryInput): Prisma.UserAccountWhereInput {
    const q = input.q?.trim();
    return {
      state:
        input.status === "ALL"
          ? { in: ["ACTIVE", "SUSPENDED"] }
          : input.status,
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { normalizedEmail: { contains: q.toLowerCase() } },
            ],
          }
        : {}),
      ...(input.registeredFrom || input.registeredTo
        ? {
            createdAt: {
              ...(rangeStart(input.registeredFrom)
                ? { gte: rangeStart(input.registeredFrom) }
                : {}),
              ...(rangeEndExclusive(input.registeredTo)
                ? { lt: rangeEndExclusive(input.registeredTo) }
                : {}),
            },
          }
        : {}),
      ...(input.type === "RECRUITER"
        ? { companyMemberships: { some: recruiterAuthorityWhere } }
        : input.type === "CANDIDATE"
          ? {
              candidateIdentity: { isNot: null },
              companyMemberships: { none: recruiterAuthorityWhere },
            }
          : {}),
    };
  }

  async list(input: DirectoryInput) {
    const where = this.where(input);
    const [rows, total] = await Promise.all([
      this.db.userAccount.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          state: true,
          version: true,
          createdAt: true,
          candidateIdentity: { select: { userId: true } },
          companyMemberships: {
            where: recruiterAuthorityWhere,
            select: { companyId: true },
          },
        },
      }),
      this.db.userAccount.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        ...row,
        maskedEmail: maskEmail(row.email),
        recruiterCompanyIds: row.companyMemberships.map(
          (membership) => membership.companyId,
        ),
        isCandidate: row.candidateIdentity !== null,
      })),
      total,
    };
  }

  private async aggregatesFor(
    rows: Array<{
      id: string;
      recruiterCompanyIds: string[];
      isCandidate: boolean;
    }>,
  ) {
    const accountIds = rows.map((row) => row.id);
    const companyIds = [
      ...new Set(rows.flatMap((row) => row.recruiterCompanyIds)),
    ];
    let candidate:
      | Map<string, { cvCount: number; applicationCount: number }>
      | undefined;
    let recruiter: Map<
      string,
      { active: number; pendingReview: number; rejected: number; draft: number; closed: number }
    > | undefined;
    let candidateUnavailable = false;
    let recruiterUnavailable = false;
    try {
      const [cvRows, applicationRows] = await Promise.all([
        accountIds.length
          ? this.db.candidateCv.groupBy({
              by: ["candidateUserId"],
              where: { candidateUserId: { in: accountIds } },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        accountIds.length
          ? this.db.jobApplication.groupBy({
              by: ["candidateUserId"],
              where: { candidateUserId: { in: accountIds } },
              _count: { _all: true },
            })
          : Promise.resolve([]),
      ]);
      candidate = new Map(
        accountIds.map((id) => [
          id,
          {
            cvCount:
              cvRows.find((row) => row.candidateUserId === id)?._count._all ??
              0,
            applicationCount:
              applicationRows.find((row) => row.candidateUserId === id)?._count
                ._all ?? 0,
          },
        ]),
      );
    } catch {
      candidateUnavailable = true;
    }
    try {
      const jobRows = companyIds.length
        ? await this.db.jobPosting.groupBy({
            by: ["companyId", "status"],
            where: {
              companyId: { in: companyIds },
              status: {
                in: ["ACTIVE", "PENDING_REVIEW", "REJECTED", "DRAFT", "CLOSED"],
              },
            },
            _count: { _all: true },
          })
        : [];
      recruiter = new Map();
      for (const row of rows) {
        const counts = {
          active: 0,
          pendingReview: 0,
          rejected: 0,
          draft: 0,
          closed: 0,
        };
        for (const job of jobRows) {
          if (!row.recruiterCompanyIds.includes(job.companyId)) continue;
          const key =
            job.status === "PENDING_REVIEW"
              ? "pendingReview"
              : job.status.toLowerCase();
          if (key in counts)
            counts[key as keyof typeof counts] += job._count._all;
        }
        recruiter.set(row.id, counts);
      }
    } catch {
      recruiterUnavailable = true;
    }
    return { candidate, recruiter, candidateUnavailable, recruiterUnavailable };
  }

  async listWithAggregates(input: DirectoryInput) {
    const page = await this.list(input);
    const aggregateRows = page.rows.map((row) => ({
      id: row.id,
      recruiterCompanyIds: row.recruiterCompanyIds,
      isCandidate: row.isCandidate,
    }));
    return { ...page, aggregates: await this.aggregatesFor(aggregateRows) };
  }

  async detail(accountId: string) {
    const account = await this.db.userAccount.findFirst({
      where: { id: accountId, state: { in: ["ACTIVE", "SUSPENDED"] } },
      select: {
        id: true,
        name: true,
        email: true,
        state: true,
        version: true,
        createdAt: true,
        candidateIdentity: { select: { userId: true } },
        companyMemberships: {
          where: {
            status: { in: ["ACTIVE", "SUSPENDED"] },
            company: { verificationState: "ACTIVE" },
          },
          orderBy: [{ companyId: "asc" }, { id: "asc" }],
          select: {
            role: true,
            status: true,
            company: {
              select: {
                id: true,
                displayName: true,
                legalName: true,
                verificationState: true,
              },
            },
          },
        },
        platformAdministratorGrants: {
          where: {
            state: "ACTIVE",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!account) return null;

    const [aggregates, history] = await Promise.all([
      this.aggregatesFor([
        {
          id: account.id,
          recruiterCompanyIds: account.companyMemberships
            .filter((membership) => membership.status === "ACTIVE")
            .map((membership) => membership.company.id),
          isCandidate: account.candidateIdentity !== null,
        },
      ]),
      this.db.auditEvent.findMany({
        where: {
          targetType: "user_account",
          targetId: account.id,
          action: {
            in: [
              "admin.account_suspended",
              "admin.account_restored",
              "admin.account_reinstated",
            ],
          },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          action: true,
          actorUserId: true,
          result: true,
          occurredAt: true,
          correlationId: true,
          context: true,
        },
      }),
    ]);
    const protectedAdministrator = account.platformAdministratorGrants.length > 0;
    return {
      account: {
        ...account,
        maskedEmail: maskEmail(account.email),
        isCandidate: account.candidateIdentity !== null,
        recruiterCompanyIds: account.companyMemberships
          .filter((membership) => membership.status === "ACTIVE")
          .map((membership) => membership.company.id),
      },
      aggregates,
      protectedAdministrator,
      authorities: account.companyMemberships.map((membership) => ({
        companyId: membership.company.id,
        companyName: membership.company.displayName || membership.company.legalName,
        membershipRole: membership.role,
        membershipState: membership.status,
        verificationState: membership.company.verificationState,
      })),
      history: history.map((event) => {
        const context = asObject(event.context);
        const action =
          event.action === "admin.account_suspended" ? "SUSPEND" : "RESTORE";
        const priorState =
          context.priorState === "SUSPENDED" || context.priorState === "ACTIVE"
            ? context.priorState
            : action === "SUSPEND"
              ? "ACTIVE"
              : "SUSPENDED";
        const resultingState =
          context.resultingState === "SUSPENDED" ||
          context.resultingState === "ACTIVE"
            ? context.resultingState
            : action === "SUSPEND"
              ? "SUSPENDED"
              : "ACTIVE";
        const result =
          event.result === "SUCCESS"
            ? "SUCCEEDED"
            : event.result === "DENIED"
              ? "DENIED"
              : "FAILED";
        const category =
          typeof context.reasonCategory === "string"
            ? context.reasonCategory
            : "OTHER";
        return {
          id: event.id,
          action,
          actorRef: event.actorUserId ?? "SYSTEM",
          priorState,
          resultingState,
          category,
          result,
          occurredAt: event.occurredAt.toISOString(),
          correlationId: event.correlationId,
        };
      }),
    };
  }
}

export { maskEmail };
