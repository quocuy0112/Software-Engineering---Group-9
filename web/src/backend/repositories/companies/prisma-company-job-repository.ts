import "server-only";

import {
  PrismaPublicJobRepository,
  type PublicJobRepository,
} from "@/backend/repositories/jobs/prisma-public-job-repository";
import type {
  NormalizedJobSearch,
  PublicJobState,
} from "@/backend/services/jobs/job-types";

/**
 * Company pages use the same candidate-visible job policy as Find Jobs and
 * add one server-side company predicate. The company id is never taken from
 * the unrestricted Find Jobs query string.
 */
export class PrismaCompanyJobRepository extends PrismaPublicJobRepository {
  async searchForCompany(
    companyId: string,
    input: NormalizedJobSearch,
    actorUserId: string | null,
    now: Date,
  ) {
    return this.search({ ...input, companyId }, actorUserId, now);
  }
}

export interface CompanyJobRepositoryPort {
  searchForCompany: PrismaCompanyJobRepository["searchForCompany"];
}

export type CompanyScopedPublicJobRepository = PublicJobRepository &
  CompanyJobRepositoryPort;

export type CompanyJobState = PublicJobState;
