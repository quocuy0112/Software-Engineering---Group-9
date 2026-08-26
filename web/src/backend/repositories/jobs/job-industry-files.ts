import "server-only";

import { resolve } from "node:path";

/** The stable filename mapping used by the generated split job catalogue. */
export const JOB_INDUSTRY_SLUGS = {
  r01: "sales",
  r02: "marketing",
  r03: "it",
  r04: "accounting",
  r05: "admin",
  r06: "hr",
  r07: "electrical",
  r08: "mechanical",
  r09: "construction",
  r10: "supply_chain",
  r11: "manufacturing",
  r12: "customer_service",
  r13: "design",
  r14: "hse",
  r15: "finance_banking",
  r16: "insurance",
  r17: "real_estate",
  r18: "healthcare",
  r19: "retail",
  r20: "hospitality",
  r21: "education",
  r22: "ecommerce",
  r23: "cosmetics",
  r24: "translation",
  r25: "media_journalism",
  r26: "textiles",
  r27: "agriculture",
  r28: "general_labor",
  r29: "other",
} as const;

export type JobIndustryCode = keyof typeof JOB_INDUSTRY_SLUGS;

/** `r29` is canonical; `other` remains readable for legacy local records. */
export function catalogueIndustryCode(value: string): JobIndustryCode | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "other") return "r29";
  return Object.prototype.hasOwnProperty.call(JOB_INDUSTRY_SLUGS, normalized)
    ? (normalized as JobIndustryCode)
    : null;
}

export function industryCodeMatchesCatalogue(
  value: unknown,
  expected: JobIndustryCode,
) {
  return value === expected || (expected === "r29" && value === "other");
}

export type JobIndustryFile = {
  code: JobIndustryCode;
  slug: (typeof JOB_INDUSTRY_SLUGS)[JobIndustryCode];
  filePath: string;
};

export function defaultJobIndustryFiles(
  root = process.cwd(),
): readonly JobIndustryFile[] {
  return Object.entries(JOB_INDUSTRY_SLUGS).map(([code, slug]) => ({
    code: code as JobIndustryCode,
    slug,
    filePath: resolve(root, "data", "jobs", `jobs_${slug}_${code}.json`),
  }));
}
