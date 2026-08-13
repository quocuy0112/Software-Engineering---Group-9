import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRecruiterJob } from "@/backend/services/jobs/recruiter-job-posting-data";
import { createEmptyJobPosting } from "@/shared/contracts/recruiter-job-posting";

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: fsMocks.readFile,
    writeFile: fsMocks.writeFile,
  },
  readFile: fsMocks.readFile,
  writeFile: fsMocks.writeFile,
}));

const company = {
  id: "company-1",
  slug: "northstar-labs",
  name: "Northstar Labs",
  logo: null,
  size: "51-200 employees",
  industry: "Technology",
  address: "Ho Chi Minh City",
  website: null,
  description: "A product company.",
  ownerUserId: "recruiter-1",
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
});
