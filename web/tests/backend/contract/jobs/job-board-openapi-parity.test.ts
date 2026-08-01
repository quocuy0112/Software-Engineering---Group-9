import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { noStoreHeaders } from "@/backend/security/response-headers";
import {
  jobDetailSchema,
  jobSearchQuerySchema,
  jobSearchResponseSchema,
} from "@/shared/contracts/jobs/discovery";
import {
  applicationFormSchema,
  applicationOutcomeSchema,
  jobReportInputSchema,
  jobReportOutcomeSchema,
  savedJobOutcomeSchema,
} from "@/shared/contracts/jobs/actions";

const featureRoot = resolve(
  process.cwd(),
  "../spec-kit/specs/003-job-board-and-advanced-search",
);
const openapi = readFileSync(
  resolve(featureRoot, "contracts/openapi.yaml"),
  "utf8",
);

describe("job board OpenAPI and runtime-contract parity", () => {
  it("documents every implemented operation and shared schema", () => {
    for (const operation of [
      "searchPublicJobs",
      "getPublicJobDetail",
      "saveOwnJob",
      "removeOwnSavedJob",
      "reportJob",
      "getOwnApplicationForm",
      "submitOwnApplication",
    ])
      expect(openapi).toContain(`operationId: ${operation}`);

    for (const schema of [
      "JobSearchResponse",
      "JobDetail",
      "SavedJobOutcome",
      "JobReportInput",
      "JobReportOutcome",
      "ApplicationForm",
      "ApplicationSubmission",
      "ApplicationOutcome",
    ])
      expect(openapi).toContain(`${schema}:`);

    expect(openapi).toContain(
      "enum: [FRAUD, MISLEADING, DUPLICATE, DISCRIMINATORY, INAPPROPRIATE, OTHER]",
    );
    expect(openapi).toContain("enum: [RELEVANCE, NEWEST, SALARY_DESC]");
  });

  it("keeps all runtime schemas strict", () => {
    const schemas = [
      jobSearchQuerySchema,
      jobSearchResponseSchema,
      jobDetailSchema,
      savedJobOutcomeSchema,
      jobReportInputSchema,
      jobReportOutcomeSchema,
      applicationFormSchema,
      applicationOutcomeSchema,
    ];
    for (const schema of schemas) {
      expect(schema.safeParse({ unsupported: "field" }).success).toBe(false);
    }
  });

  it("documents public cacheability and protected no-store behavior", () => {
    expect(openapi).toContain("public, max-age=30, stale-while-revalidate=60");
    expect(openapi).toContain("no-store, max-age=0");
    expect(noStoreHeaders["Cache-Control"]).toBe("no-store, max-age=0");

    const publicRoutes = [
      "src/app/api/jobs/route.ts",
      "src/app/api/jobs/[jobId]/route.ts",
    ];
    const protectedRoutes = [
      "src/app/api/saved-jobs/[jobId]/route.ts",
      "src/app/api/jobs/[jobId]/reports/route.ts",
      "src/app/api/jobs/[jobId]/application-form/route.ts",
      "src/app/api/jobs/[jobId]/applications/route.ts",
    ];
    for (const path of publicRoutes)
      expect(readFileSync(path, "utf8"), path).toContain("publicJobJson");
    for (const path of protectedRoutes)
      expect(readFileSync(path, "utf8"), path).toContain("jobJson");
  });
});
