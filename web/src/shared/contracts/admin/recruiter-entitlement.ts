import { z } from "zod";
export const recruiterCompanyOptionSchema = z
  .object({
    companyId: z.string().min(1),
    companyName: z.string().min(1).max(240),
    membershipId: z.string().min(1),
    role: z.enum(["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"]),
    membershipVersion: z.number().int().positive(),
  })
  .strict();
export const recruiterEntitlementSchema = z
  .object({
    available: z.boolean(),
    requiresSelection: z.boolean(),
    selectedCompanyId: z.string().nullable(),
    companies: z.array(recruiterCompanyOptionSchema),
    destinations: z.tuple([
      z.object({ label: z.literal("Candidate Dashboard"), href: z.string() }),
      z.object({ label: z.literal("Employer Verification"), href: z.string() }),
    ]),
  })
  .strict();
export const recruiterSelectionSchema = z
  .object({ companyId: z.string().min(1) })
  .strict();
