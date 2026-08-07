import { describe, expect, it } from "vitest";
import { jobSearchResponseSchema } from "@/shared/contracts/jobs/discovery";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";

describe("GET /api/jobs contract", () => {
  it("returns the strict public projection from a repository result", async () => {
    const repository = {
      search: async () => ({
        rows: [
          {
            id: "job-1",
            companyId: "company-1",
            slug: "lap-trinh-vien",
            title: "Lập trình viên",
            normalizedTitle: "lap trinh vien",
            summary: "Build products.",
            education: "Bachelor's degree or above",
            numberOfHires: 3,
            age: "23-26",
            description: "Detailed description.",
            responsibilities: "Design and implement.",
            requirements: "TypeScript experience.",
            benefits: null,
            location: "Hồ Chí Minh",
            normalizedLocation: "ho chi minh",
            employmentType: "FULL_TIME" as const,
            experienceLevel: "MID" as const,
            workArrangement: "HYBRID" as const,
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            salaryPeriod: null,
            searchDocumentNormalized: "lap trinh vien",
            status: "ACTIVE" as const,
            approvedAt: new Date("2026-07-01T00:00:00.000Z"),
            publishedAt: new Date("2026-08-01T00:00:00.000Z"),
            applicationDeadline: null,
            closedAt: null,
            removedAt: null,
            version: 1,
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            company: {
              slug: "smart-hire",
              displayName: "SmartHire",
              logoUrl: null,
              websiteUrl: null,
              publicDescription: null,
              publicLocation: "Hồ Chí Minh",
              size: "201-500 employees",
              industry: "Information Technology (IT)",
              address: "District 1, Ho Chi Minh City",
            },
            skills: [{ displayName: "TypeScript" }],
            savedBy: [],
            applications: [],
            score: 1,
          },
        ],
        total: 1,
        nextCursor: null,
      }),
      findPublicBySlug: async () => null,
      findPublicActionTarget: async () => null,
    };
    const result = await new JobDiscoveryService(repository).search(
      {},
      { kind: "visitor" },
      new Date("2026-08-01T08:00:00.000Z"),
    );
    expect(jobSearchResponseSchema.parse(result).items[0]).not.toHaveProperty(
      "moderationReason",
    );
  });
});
