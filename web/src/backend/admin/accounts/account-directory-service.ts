import "server-only";
import { PrismaAccountDirectoryRepository } from "@/backend/repositories/admin/prisma-account-directory-repository";
import {
  accountDirectoryFilterSchema,
  accountDirectoryItemSchema,
  type AccountDirectoryFilter,
} from "@/shared/contracts/admin/resources";

function directoryItem(
  row: Awaited<ReturnType<PrismaAccountDirectoryRepository["listWithAggregates"]>>["rows"][number],
  aggregate: Awaited<ReturnType<PrismaAccountDirectoryRepository["listWithAggregates"]>>["aggregates"],
) {
  const recruiter = row.recruiterCompanyIds.length > 0;
  const counts = recruiter
    ? aggregate.recruiterUnavailable
      ? { kind: "RECRUITER" as const, unavailable: true as const }
      : {
          kind: "RECRUITER" as const,
          ...(aggregate.recruiter?.get(row.id) ?? {
            active: 0,
            pendingReview: 0,
            rejected: 0,
            draft: 0,
            closed: 0,
          }),
        }
    : aggregate.candidateUnavailable
      ? { kind: "CANDIDATE" as const, unavailable: true as const }
      : {
          kind: "CANDIDATE" as const,
          ...(aggregate.candidate?.get(row.id) ?? {
            cvCount: 0,
            applicationCount: 0,
          }),
        };
  return accountDirectoryItemSchema.parse({
    id: row.id,
    accountReference: row.id,
    displayName: row.name,
    maskedEmail: row.maskedEmail,
    registeredAt: row.createdAt.toISOString(),
    type: recruiter ? "RECRUITER" : "CANDIDATE",
    status: row.state,
    version: row.version,
    counts,
  });
}

export class AccountDirectoryService {
  constructor(
    private readonly repository = new PrismaAccountDirectoryRepository(),
  ) {}

  async list(input: unknown) {
    const filter = accountDirectoryFilterSchema.parse(input);
    const result = await this.repository.listWithAggregates(filter);
    return {
      data: result.rows.map((row) => directoryItem(row, result.aggregates)),
      page: filter.page,
      pageSize: filter.pageSize,
      total: result.total,
      calculatedAt: new Date().toISOString(),
    };
  }

  static normalizeQuery(input: Record<string, string | null>) {
    return accountDirectoryFilterSchema.parse({
      q: input.q ?? undefined,
      type: input.type ?? undefined,
      status: input.status ?? undefined,
      registeredFrom: input.registeredFrom ?? undefined,
      registeredTo: input.registeredTo ?? undefined,
      page: input.page ?? undefined,
      pageSize: input.pageSize ?? undefined,
    });
  }
}

export type { AccountDirectoryFilter };
