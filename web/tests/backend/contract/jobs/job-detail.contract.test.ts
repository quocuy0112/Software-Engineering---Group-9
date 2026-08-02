import { describe, expect, it } from "vitest";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import { jobDetailSchema } from "@/shared/contracts/jobs/discovery";

const row = {
  id: "job-1",
  companyId: "company-1",
  slug: "lap-trinh-vien",
  title: "Lập trình viên",
  normalizedTitle: "lap trinh vien",
  summary: "Build products.",
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
  publishedAt: new Date("2026-07-20T00:00:00.000Z"),
  applicationDeadline: null,
  closedAt: null,
  removedAt: null,
  version: 1,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
  company: {
    slug: "smart-hire",
    displayName: "SmartHire",
    logoUrl: null,
    websiteUrl: null,
    publicDescription: null,
    publicLocation: "Hồ Chí Minh",
  },
  skills: [{ displayName: "TypeScript" }],
  savedBy: [],
  applications: [],
  score: 0,
};

describe("GET /api/jobs/{slug} contract", () => {
  it("returns an approved strict public detail", async () => {
    const service = new JobDiscoveryService({
      search: async () => ({ rows: [], total: 0, nextCursor: null }),
      findPublicBySlug: async () => row,
      findPublicActionTarget: async () => null,
    });
    const result = await service.detail(
      "lap-trinh-vien",
      { kind: "visitor" },
      new Date("2026-08-01T08:00:00.000Z"),
      "https://jobs.example.test",
    );
    expect(jobDetailSchema.parse(result)).toMatchObject({ state: "ACTIVE" });
    expect(result).not.toHaveProperty("companyId");
    expect(result).not.toHaveProperty("approvedAt");
  });

  it("uses one neutral not-found outcome", async () => {
    const service = new JobDiscoveryService({
      search: async () => ({ rows: [], total: 0, nextCursor: null }),
      findPublicBySlug: async () => null,
      findPublicActionTarget: async () => null,
    });
    await expect(
      service.detail(
        "private-or-missing",
        { kind: "visitor" },
        new Date(),
        "https://jobs.example.test",
      ),
    ).rejects.toMatchObject({
      status: 404,
      body: { code: "JOB_UNAVAILABLE" },
    });
  });
});
