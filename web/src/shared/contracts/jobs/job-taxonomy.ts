import { z } from "zod";

export const recruiterJobTaxonomySubIndustrySchema = z
  .object({
    code: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(160),
  })
  .strict();

export const recruiterJobTaxonomyIndustrySchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    subIndustries: z.array(recruiterJobTaxonomySubIndustrySchema).max(500),
  })
  .strict();

export const recruiterJobTaxonomySchema = z
  .object({
    version: z.string().trim().min(1).max(64),
    industries: z.array(recruiterJobTaxonomyIndustrySchema).max(100),
  })
  .strict();

export type RecruiterJobTaxonomySubIndustry = z.infer<
  typeof recruiterJobTaxonomySubIndustrySchema
>;
export type RecruiterJobTaxonomyIndustry = z.infer<
  typeof recruiterJobTaxonomyIndustrySchema
>;
export type RecruiterJobTaxonomy = z.infer<typeof recruiterJobTaxonomySchema>;
