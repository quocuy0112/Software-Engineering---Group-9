import { describe, expect, it } from "vitest";
import {
  privateMatchListResponseSchema,
  privateMatchResponseSchema,
  privateMatchStatusSchema,
} from "@/shared/contracts/private-cv-match";

const base = {
  checkId: "pmc_1",
  createdAt: "2026-08-16T00:00:00.000Z",
  expiresAt: "2027-08-16T00:00:00.000Z",
  provenance: {
    cvVersionId: "cv-1", cvVersion: 1, jdVersion: 3,
    scoringConfigVersion: "HS-40/60-v1", aiProvider: null, aiModel: null,
    promptVersion: null, inputPolicyVersion: null,
  },
  cv: {
    versionId: "cv-1", version: 1, displayName: "Resume", fileName: "resume.pdf",
    mimeType: "application/pdf", byteSize: 100, pageCount: null,
    parseStatus: "READY", confirmedAt: "2026-08-16T00:00:00.000Z",
  },
  job: {
    jobId: "job-1", slug: "java-engineer", title: "Java Engineer", company: "Acme",
    location: "Remote", employmentType: "FULL_TIME", workArrangement: "REMOTE",
    requiredExperienceYears: 3, requirements: ["Java"], jdVersion: 3,
    jdUpdatedAt: "2026-08-16T00:00:00.000Z",
  },
};

describe("private match response contracts", () => {
  it("accepts status and keeps the response allow-listed", () => {
    const response = privateMatchStatusSchema.parse({
      ...base,
      view: "STATUS",
      state: "QUEUED",
      failureCode: null,
      durationSeconds: null,
    });
    expect(response.view).toBe("STATUS");
    expect(() => privateMatchStatusSchema.parse({ ...response, rank: 1 })).toThrow();
  });

  it("does not accept employer-only score/ranking fields in status", () => {
    expect(() => privateMatchResponseSchema.parse({
      ...base,
      view: "STATUS",
      state: "QUEUED",
      failureCode: null,
      durationSeconds: null,
      internalNotes: "secret",
      recruiterScore: 99,
    })).toThrow();
  });

  it("keeps the saved-check list owner-safe and report-free", () => {
    const response = privateMatchListResponseSchema.parse({
      items: [{
        checkId: "pmc_1",
        state: "READY",
        createdAt: "2026-08-16T00:00:00.000Z",
        expiresAt: "2027-08-16T00:00:00.000Z",
        job: { jobId: "job-1", slug: "java-engineer", title: "Java Engineer", company: "Acme", location: "Remote" },
        cv: { versionId: "cv-1", displayName: "Resume", fileName: "resume.pdf", version: 1 },
        hybridScore: 89.6,
        deterministicScore: 92,
      }],
    });
    expect(response.items[0]?.hybridScore).toBe(89.6);
    expect(() => privateMatchListResponseSchema.parse({ items: [{ ...response.items[0], rank: 1 }] })).toThrow();
  });
});
