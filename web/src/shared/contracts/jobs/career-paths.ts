import { z } from "zod";

/**
 * The public career-path taxonomy intentionally lives beside the job-search
 * contract.  It is used by Home to show active-job counts and by /jobs to
 * apply the exact same filter after a visitor selects a path.
 *
 * JobPosting does not persist a separate category relation yet.  The public
 * search document does persist the source industry and sub-industry, so these
 * normalized terms form a stable, explicit bridge without inventing counts.
 */
export const careerPathSlugs = [
  "software-engineering",
  "ui-ux-design",
  "data-ai",
  "digital-marketing",
  "business-sales",
  "product-management",
] as const;

export const careerPathSlugSchema = z.enum(careerPathSlugs);
export type CareerPathSlug = z.infer<typeof careerPathSlugSchema>;

export const careerPathSearchTerms: Readonly<
  Record<CareerPathSlug, readonly string[]>
> = {
  "software-engineering": ["software development"],
  "ui-ux-design": ["graphic digital design"],
  "data-ai": ["data ai"],
  "digital-marketing": ["digital marketing"],
  "business-sales": ["sales business development"],
  "product-management": ["it product project management"],
};
