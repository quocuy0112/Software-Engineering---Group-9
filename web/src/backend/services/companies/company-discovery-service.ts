import "server-only";

import { PrismaCompanyDiscoveryRepository } from "@/backend/repositories/companies/prisma-company-discovery-repository";
import {
  PrismaTeamOpportunityRepository,
  type TeamOpportunityRow,
  type TeamOpportunityRepositoryPort,
} from "@/backend/repositories/company-members/prisma-team-opportunity-repository";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import type { JobActor } from "@/backend/services/jobs/job-types";
import {
  companyDetailSchema,
  companyListQuerySchema,
  companyListResponseSchema,
  type CompanyDetail,
  type CompanyListResponse,
} from "@/shared/contracts/company";
import {
  teamRoleSchema,
  type TeamRole,
} from "@/shared/contracts/company-members/team-applications";
import { CompanyDiscoveryAuthorizationError } from "./company-discovery-authorization";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 50;
const unavailableDescription = "No public company description is available.";

export function companySizeRange(activeEmployeeCount: number): string {
  if (activeEmployeeCount <= 0) return "Unavailable";
  if (activeEmployeeCount <= 10) return "1–10 employees";
  if (activeEmployeeCount <= 50) return "11–50 employees";
  if (activeEmployeeCount <= 200) return "51–200 employees";
  if (activeEmployeeCount <= 500) return "201–500 employees";
  if (activeEmployeeCount <= 1_000) return "501–1,000 employees";
  return "1,001+ employees";
}

function safeDescription(value: string | null) {
  return value?.trim() || unavailableDescription;
}

function pageNumber(value: number | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : 1;
}

function pageLimit(value: number | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0
    ? Math.min(value!, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

export function openRoles(
  opportunities: readonly Pick<TeamOpportunityRow, "role" | "state">[],
  hasActiveOwner = true,
): TeamRole[] {
  if (!hasActiveOwner) return [];
  // Opportunities are created lazily on the first application. Until then,
  // both supported pathways are open for every approved company with an Owner.
  if (!opportunities.length) return ["HR_MANAGER", "RECRUITER"];
  const stateByRole = new Map<TeamRole, TeamOpportunityRow["state"]>();
  for (const opportunity of opportunities) {
    const role = teamRoleSchema.safeParse(opportunity.role);
    if (role.success) stateByRole.set(role.data, opportunity.state);
  }
  return (["HR_MANAGER", "RECRUITER"] as const).filter(
    (role) => stateByRole.get(role) !== "CLOSED",
  );
}

export class CompanyDiscoveryService {
  constructor(
    private readonly repository = new PrismaCompanyDiscoveryRepository(),
    private readonly jobs = new JobDiscoveryService(),
    private readonly opportunities: TeamOpportunityRepositoryPort = new PrismaTeamOpportunityRepository(),
  ) {}

  async list(input: { q?: string; page?: number; limit?: number } = {}) {
    const query = companyListQuerySchema.parse({
      q: input.q,
      page: pageNumber(input.page),
      limit: pageLimit(input.limit),
    });
    const result = await this.repository.list({
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
    const response: CompanyListResponse = {
      items: result.items.map((company) => ({
        companyId: company.id,
        slug: company.slug,
        name: company.displayName,
        logoUrl: company.logoUrl,
        description: safeDescription(company.publicDescription),
      })),
      page: query.page,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
    return companyListResponseSchema.parse(response);
  }

  async detail(
    companyId: string,
    actor: JobActor,
    rawJobSearch: unknown = {},
    now = new Date(),
  ): Promise<CompanyDetail> {
    const company = await this.repository.findById(companyId);
    if (!company) {
      throw new CompanyDiscoveryAuthorizationError("COMPANY_UNAVAILABLE");
    }
    const [jobs, opportunities] = await Promise.all([
      this.jobs.searchScoped(rawJobSearch, actor, now, { companyId }),
      this.opportunities.listForCompany(company.id),
    ]);
    const roles = openRoles(opportunities, company.activeOwnerCount > 0);
    return companyDetailSchema.parse({
      companyId: company.id,
      slug: company.slug,
      name: company.displayName,
      logoUrl: company.logoUrl,
      description: safeDescription(company.publicDescription),
      foundedYear: company.foundedYear,
      sizeRange: companySizeRange(company.activeEmployeeCount),
      industry: company.industry?.trim() || null,
      location: company.publicLocation?.trim() || null,
      activeEmployeeCount: company.activeEmployeeCount,
      teamRoles: roles,
      jobs: jobs.items,
      jobTotal: jobs.total,
      jobPage: jobs.page,
      jobTotalPages: jobs.totalPages,
    });
  }
}

export { unavailableDescription };
