import { z } from "zod";
import { jobCardSchema } from "@/shared/contracts/jobs/discovery";
import { teamRoleSchema } from "@/shared/contracts/company-members/team-applications";

export const companyCardSchema = z
  .object({
    companyId: z.string().min(1).max(128),
    slug: z.string().min(1).max(200),
    name: z.string().min(1).max(160),
    logoUrl: z.string().nullable(),
    description: z.string().max(3_000),
  })
  .strict();

export const companyListResponseSchema = z
  .object({
    items: z.array(companyCardSchema).max(100),
    page: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const companyListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional().default(""),
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(24),
  })
  .strict();

export const companyDetailSchema = companyCardSchema
  .extend({
    foundedYear: z.number().int().positive().nullable(),
    sizeRange: z.string().min(1).max(80),
    industry: z.string().max(160).nullable(),
    location: z.string().max(300).nullable(),
    activeEmployeeCount: z.number().int().nonnegative(),
    teamRoles: z.array(teamRoleSchema).max(2),
    jobs: z.array(jobCardSchema).max(50),
    jobTotal: z.number().int().nonnegative().default(0),
    jobPage: z.number().int().positive().default(1),
    jobTotalPages: z.number().int().nonnegative().default(0),
  })
  .strict();

export const companyJobSearchQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional().default(""),
    location: z.string().trim().max(160).optional().default(""),
    page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const companyJobSearchResponseSchema = z
  .object({
    items: z.array(jobCardSchema).max(50),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    page: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    companyId: z.string().min(1).max(128),
  })
  .strict();

export type CompanyCard = z.infer<typeof companyCardSchema>;
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
export type CompanyListResponse = z.infer<typeof companyListResponseSchema>;
export type CompanyDetail = z.infer<typeof companyDetailSchema>;
export type CompanyJobSearchQuery = z.infer<typeof companyJobSearchQuerySchema>;
export type CompanyJobSearchResponse = z.infer<
  typeof companyJobSearchResponseSchema
>;
