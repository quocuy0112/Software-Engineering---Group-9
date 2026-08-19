import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorizeLegacyRecruiterJobs,
  createRecruiterJob,
  readRecruiterCompanySettings,
  readRecruiterJobManagementData,
  updateRecruiterJob,
  updateRecruiterCompanySettings,
} from "@/backend/services/jobs/recruiter-job-posting-data";
import { createEmptyJobPosting } from "@/shared/contracts/recruiter-job-posting";

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  temporaryWrites: new Map<string, string>(),
}));

const prismaMocks = vi.hoisted(() => ({
  company: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  jobPostReviewAggregate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("node:fs/promises", () => {
  const stat = vi.fn(async (path: string) => ({
    isFile: () => path.endsWith(".json"),
    isDirectory: () => !path.endsWith(".json"),
  }));
  const open = vi.fn(async (path: string) => ({
    writeFile: async (value: string) => {
      fsMocks.temporaryWrites.set(path, value);
    },
    sync: async () => undefined,
    close: async () => undefined,
  }));
  const rename = vi.fn(async (source: string, target: string) => {
    await fsMocks.writeFile(
      target,
      fsMocks.temporaryWrites.get(source),
      "utf8",
    );
  });
  const rm = vi.fn(async () => undefined);
  const mocked = {
    readFile: fsMocks.readFile,
    writeFile: fsMocks.writeFile,
    stat,
    open,
    rename,
    rm,
  };
  return {
    default: mocked,
    ...mocked,
  };
});

vi.mock("@/backend/database/prisma", () => ({
  prisma: prismaMocks,
}));

const company = {
  id: "company-1",
  slug: "northstar-labs",
  name: "Northstar Labs",
  logo: "https://example.com/logo.png",
  size: "51-200 employees",
  industry: "Technology",
  address: "Ho Chi Minh City",
  website: null,
  description: "A product company.",
  ownerUserId: "recruiter-1",
  memberUserIds: [],
  taxCode: "1234567890",
  verificationStatus: "approved",
};

function completeJob(id: string) {
  const job = createEmptyJobPosting("company-1");
  return {
    ...job,
    id,
    slug: id,
    title: "Product Designer",
    shortPitch: "Build thoughtful hiring experiences.",
    description: {
      ...job.description,
      overview: "Own end-to-end product design.",
    },
  };
}

describe("recruiter JSON job persistence", () => {
  beforeEach(() => {
    fsMocks.readFile.mockReset();
    fsMocks.writeFile.mockReset();
    fsMocks.writeFile.mockResolvedValue(undefined);
    fsMocks.temporaryWrites.clear();
    prismaMocks.company.findMany.mockReset();
    prismaMocks.company.findMany.mockResolvedValue([]);
    prismaMocks.company.update.mockReset();
    prismaMocks.company.update.mockResolvedValue({});
    prismaMocks.jobPostReviewAggregate.findMany.mockReset();
    prismaMocks.jobPostReviewAggregate.findMany.mockResolvedValue([]);
    prismaMocks.jobPostReviewAggregate.findUnique.mockReset();
    prismaMocks.jobPostReviewAggregate.findUnique.mockResolvedValue(null);
  });

  it("exposes an admin-approved database company to recruiter settings", async () => {
    prismaMocks.company.findMany.mockResolvedValue([
      {
        id: "db-company-1",
        slug: "northstar-labs",
        legalName: "Northstar Labs",
        displayName: "Northstar Labs",
        logoUrl: null,
        websiteUrl: null,
        publicDescription: null,
        publicLocation: null,
        size: null,
        industry: null,
        address: null,
        entityType: null,
        normalizedTaxIdentifier: "1234567890",
        memberships: [{ userId: "recruiter-1", role: "OWNER" }],
      },
    ]);
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return "[]";
      if (path.endsWith("companies.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    const settings = await readRecruiterCompanySettings("recruiter-1");

    expect(settings).toMatchObject({
      id: "db-company-1",
      name: "Northstar Labs",
      verificationStatus: "approved",
      profileComplete: false,
      missingProfileFields: ["industry", "size", "address", "logo"],
    });
  });

  it("keeps a registry entity type out of the company display name", async () => {
    prismaMocks.company.findMany.mockResolvedValue([
      {
        id: "db-company-2",
        slug: "vnpt",
        legalName:
          "TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM (LOẠI HÌNH DOANH NGHIỆP: CÔNG TY TNHH)",
        displayName:
          "TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM (LOẠI HÌNH DOANH NGHIỆP: CÔNG TY TNHH)",
        logoUrl: null,
        websiteUrl: null,
        publicDescription: null,
        publicLocation: null,
        size: null,
        industry: null,
        address: null,
        entityType: null,
        normalizedTaxIdentifier: "0100684378",
        memberships: [{ userId: "recruiter-1", role: "OWNER" }],
      },
    ]);
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return "[]";
      if (path.endsWith("companies.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    await expect(
      readRecruiterCompanySettings("recruiter-1"),
    ).resolves.toMatchObject({
      name: "TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM",
      entityType: "CÔNG TY TNHH",
    });
  });

  it("allows an approved database member to open job posting management", async () => {
    prismaMocks.company.findMany.mockResolvedValue([
      {
        id: "db-company-1",
        slug: "northstar-labs",
        legalName: "Northstar Labs",
        displayName: "Northstar Labs",
        logoUrl: "https://example.com/logo.png",
        websiteUrl: "https://northstar.example.com",
        publicDescription: "A product company.",
        publicLocation: "Ho Chi Minh City",
        size: "51-200 employees",
        industry: "Technology",
        address: "Ho Chi Minh City",
        entityType: null,
        normalizedTaxIdentifier: "1234567890",
        memberships: [{ userId: "recruiter-1", role: "OWNER" }],
      },
    ]);
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return "[]";
      if (path.endsWith("companies.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    const data = await readRecruiterJobManagementData("recruiter-1");

    expect(data.companyId).toBe("db-company-1");
    expect(data.companies).toHaveLength(1);
    expect(data.companyProfileComplete).toBe(true);
  });

  it("freshly aggregates jobs across every active company membership", async () => {
    prismaMocks.company.findMany.mockResolvedValue([
      {
        id: "db-company-1",
        slug: "northstar-labs",
        legalName: "Northstar Labs",
        displayName: "Northstar Labs",
        logoUrl: null,
        websiteUrl: null,
        publicDescription: null,
        publicLocation: "Ho Chi Minh City",
        size: "51-200 employees",
        industry: "Technology",
        address: "Ho Chi Minh City",
        entityType: null,
        normalizedTaxIdentifier: "1234567890",
        memberships: [{ userId: "recruiter-1", role: "OWNER" }],
      },
      {
        id: "db-company-2",
        slug: "second-company",
        legalName: "Second Company",
        displayName: "Second Company",
        logoUrl: null,
        websiteUrl: null,
        publicDescription: null,
        publicLocation: "Hanoi",
        size: "51-200 employees",
        industry: "Technology",
        address: "Hanoi",
        entityType: null,
        normalizedTaxIdentifier: "9876543210",
        memberships: [{ userId: "recruiter-1", role: "RECRUITER" }],
      },
    ]);
    const firstJob = {
      ...completeJob("job-company-1"),
      companyId: "db-company-1",
    };
    const secondJob = {
      ...completeJob("job-company-2"),
      companyId: "db-company-2",
    };
    let jobsText = JSON.stringify([firstJob, secondJob]);
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return jobsText;
      if (path.endsWith("companies.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    const firstRead = await readRecruiterJobManagementData("recruiter-1");
    expect(firstRead.jobs.map((job) => job.id)).toEqual([
      "job-company-1",
      "job-company-2",
    ]);

    const newJob = {
      ...completeJob("job-company-2-new"),
      companyId: "db-company-2",
      stats: { viewCount: 3, applicantCount: 17 },
    };
    jobsText = JSON.stringify([firstJob, secondJob, newJob]);
    const refreshedRead = await readRecruiterJobManagementData("recruiter-1");

    expect(refreshedRead.jobs.map((job) => job.id)).toEqual([
      "job-company-1",
      "job-company-2",
      "job-company-2-new",
    ]);
    expect(
      refreshedRead.jobs.find((job) => job.id === "job-company-2-new"),
    ).toMatchObject({
      companyId: "db-company-2",
      stats: { applicantCount: 17 },
    });
  });

  it("uses active database membership when legacy catalog membership is stale", async () => {
    prismaMocks.company.findMany.mockResolvedValue([
      {
        id: "db-company-1",
        slug: "northstar-labs",
        legalName: "Northstar Labs",
        displayName: "Northstar Labs",
        logoUrl: null,
        websiteUrl: null,
        publicDescription: null,
        publicLocation: "Ho Chi Minh City",
        size: "51-200 employees",
        industry: "Technology",
        address: "Ho Chi Minh City",
        entityType: null,
        normalizedTaxIdentifier: "1234567890",
        memberships: [{ userId: "recruiter-1", role: "RECRUITER" }],
      },
    ]);
    const catalogCompany = {
      ...company,
      ownerUserId: null,
      memberUserIds: [],
      verificationStatus: "pending",
    };
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) {
        return JSON.stringify([
          { ...completeJob("legacy-job"), companyId: company.id },
        ]);
      }
      if (path.endsWith("companies.json")) {
        return JSON.stringify([catalogCompany]);
      }
      throw new Error("Unexpected mock path: " + path);
    });

    await expect(
      authorizeLegacyRecruiterJobs("recruiter-1", ["legacy-job"]),
    ).resolves.toEqual(
      new Map([
        [
          "legacy-job",
          {
            jobId: "legacy-job",
            companyId: company.id,
            jobTitle: "Product Designer",
          },
        ],
      ]),
    );
  });

  it("saves a complete profile for a database-backed company", async () => {
    prismaMocks.company.findMany.mockResolvedValue([
      {
        id: "db-company-1",
        slug: "dava",
        legalName: "Dava",
        displayName: "Dava",
        logoUrl: "https://example.com/old-logo.png",
        websiteUrl: "https://example.com/old",
        publicDescription: "Old description",
        publicLocation: "Ho Chi Minh City",
        size: "1-50 employees",
        industry: "Game Development",
        address: "Ho Chi Minh, District 8",
        entityType: null,
        normalizedTaxIdentifier: "2000000000",
        memberships: [{ userId: "recruiter-1", role: "OWNER" }],
      },
    ]);
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return "[]";
      if (path.endsWith("companies.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    const saved = await updateRecruiterCompanySettings("recruiter-1", {
      name: "Dava",
      industry: "Game Development",
      size: "1-50 employees",
      address: "Ho Chi Minh, District 8",
      logo: "https://example.com/dava-logo.png",
      website: "https://example.com/Dava",
      description: "A verified SmartHire employer.",
    });

    expect(saved.profileComplete).toBe(true);
    expect(saved.missingProfileFields).toEqual([]);
    const companiesWrite = fsMocks.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith("companies.json"),
    );
    expect(companiesWrite).toBeDefined();
    expect(JSON.parse(String(companiesWrite?.[1]))).toContainEqual(
      expect.objectContaining({
        id: "db-company-1",
        name: "Dava",
        taxCode: "2000000000",
      }),
    );
    expect(prismaMocks.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "db-company-1" } }),
    );
  });

  it("persists every expanded jobs.json field for a recruiter posting", async () => {
    const job = completeJob("new-job");
    job.salary = {
      min: 29_000_000,
      max: 33_000_000,
      currency: "VND",
      period: "month",
      isNegotiable: true,
    };
    job.experience = { minYears: 3, label: "3+ years" };
    job.level = "senior";
    job.employmentType = "contract";
    job.workOnSaturday = true;
    job.education = "Bachelor's degree or above";
    job.age = "24-35";
    job.numberOfHires = 3;
    job.isUrgent = true;
    job.location = {
      city: "Ho Chi Minh City",
      district: null,
      isNationwideRemote: true,
    };
    job.description = {
      overview: "Own end-to-end product design.",
      topReasonsToJoin: ["Own meaningful product decisions"],
      responsibilities: ["Own platform reliability"],
      requirements: ["Strong TypeScript"],
      benefits: [{ icon: "gift", label: "Holiday and Tet bonus" }],
      generalInfo: {
        reportsTo: "Head of Engineering",
        department: "Engineering",
        workingHours: "Monday-Friday, 9:00-18:00",
        workAddress: "District 1, Ho Chi Minh City",
      },
    };
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return "[]";
      if (path.endsWith("companies.json")) return JSON.stringify([company]);
      if (path.endsWith("applications.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    await createRecruiterJob("recruiter-1", job, "draft");

    const jobWrite = fsMocks.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith("jobs.json"),
    );
    const persisted = JSON.parse(String(jobWrite?.[1])) as Array<typeof job>;
    expect(persisted.at(-1)).toMatchObject({
      salary: job.salary,
      experience: job.experience,
      level: "senior",
      employmentType: "contract",
      workOnSaturday: true,
      education: "Bachelor's degree or above",
      age: "24-35",
      numberOfHires: 3,
      isUrgent: true,
      location: job.location,
      description: job.description,
    });
  });
  it("appends a posting without normalizing untouched legacy job statuses", async () => {
    const existing = { ...completeJob("legacy-job"), status: "open" };
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return JSON.stringify([existing]);
      if (path.endsWith("companies.json")) return JSON.stringify([company]);
      if (path.endsWith("applications.json")) return "[]";
      throw new Error("Unexpected mock path: " + path);
    });

    await createRecruiterJob("recruiter-1", completeJob("new-job"), "draft");

    const jobWrite = fsMocks.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith("jobs.json"),
    );
    expect(jobWrite).toBeDefined();
    const persisted = JSON.parse(String(jobWrite?.[1])) as Array<{
      id: string;
      status: string;
    }>;
    expect(persisted[0]).toMatchObject({
      id: "legacy-job",
      status: "open",
    });
    expect(persisted.at(-1)?.status).toBe("draft");
  });

  it("updates an approved recruiter projection without persisting review metadata", async () => {
    const existing = {
      ...completeJob("approved-job"),
      status: "active" as const,
      applyDeadline: "2099-12-31T23:59:59.000Z",
    };
    const recruiterProjection = {
      ...existing,
      company,
      review: {
        reviewId: "review-1",
        jobId: existing.id,
        sequence: 1,
        state: "APPROVED" as const,
        readOnly: false,
        reasonCode: null,
        publicExplanation: null,
        submittedAt: "2026-08-18T00:00:00.000Z",
        decidedAt: "2026-08-18T01:00:00.000Z",
        version: 1,
      },
      correctionRequest: {
        id: "correction-1",
        publicExplanation: "Keep the approved version live.",
        hideImmediately: false,
        createdAt: "2026-08-18T02:00:00.000Z",
      },
      title: "Updated Product Designer",
    };
    fsMocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("jobs.json")) return JSON.stringify([existing]);
      if (path.endsWith("companies.json")) return JSON.stringify([company]);
      throw new Error("Unexpected mock path: " + path);
    });

    const saved = await updateRecruiterJob("recruiter-1", recruiterProjection);

    expect(saved.title).toBe("Updated Product Designer");
    const jobWrite = fsMocks.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith("jobs.json"),
    );
    const persisted = JSON.parse(String(jobWrite?.[1])) as Array<
      Record<string, unknown>
    >;
    expect(persisted[0]).not.toHaveProperty("review");
    expect(persisted[0]).not.toHaveProperty("correctionRequest");
    expect(persisted[0]).not.toHaveProperty("company");
  });
});
