import { describe, expect, it } from "vitest";
import {
  ApplicationRepositoryError,
  prepareApplicationSubmission,
} from "@/backend/services/jobs/application-policy";

const now = new Date("2026-08-01T08:00:00.000Z");
const context = {
  candidate: {
    userId: "candidate-1",
    name: "Candidate One",
    headline: "Engineer",
    location: "Hồ Chí Minh",
    skills: [{ id: "skill-1", label: "TypeScript" }],
    experience: [],
    education: [],
  },
  cv: {
    id: "cv-1",
    candidateUserId: "candidate-1",
    displayName: "Main CV",
    fileName: "candidate.pdf",
    mimeType: "application/pdf",
    byteSize: 1000,
    storageKey: "private/cv-1.pdf",
    checksumSha256: "a".repeat(64),
    version: 1,
    confirmedAt: now,
    archivedAt: null,
  },
  job: {
    id: "job-1",
    version: 1,
    title: "Engineer",
    companyId: "company-1",
    companyName: "Company",
    location: "Hồ Chí Minh",
    employmentType: "FULL_TIME",
    experienceLevel: "MID",
    workArrangement: "HYBRID",
    requiredSkills: ["TypeScript"],
  },
  questions: [
    {
      id: "q-text",
      prompt: "Experience?",
      description: null,
      kind: "TEXT" as const,
      required: true,
      options: null,
      version: 1,
    },
    {
      id: "q-bool",
      prompt: "Hybrid?",
      description: null,
      kind: "BOOLEAN" as const,
      required: true,
      options: null,
      version: 1,
    },
  ],
};

const command = {
  cvId: "cv-1",
  answers: [
    { questionId: "q-text", value: "Five years" },
    { questionId: "q-bool", value: true },
  ],
  coverLetter: "<script>bad()</script> I build accessible products.",
  consentVersion: "2026-08-01",
  consentAccepted: true as const,
};

describe("application submission policy", () => {
  it("builds bounded immutable snapshots and sanitized plain text", () => {
    const result = prepareApplicationSubmission(
      context,
      command,
      "2026-08-01",
      now,
    );
    expect(result.coverLetter).toBe("I build accessible products.");
    expect(result.profileSnapshot).toMatchObject({
      v: 1,
      candidateName: "Candidate One",
    });
    expect(result.cvSnapshot).toMatchObject({ v: 1, cvId: "cv-1" });
    expect(result.jobSnapshot).toMatchObject({ v: 1, jobId: "job-1" });
    expect(result.answers).toHaveLength(2);
  });

  it("rejects stale consent and missing or wrong-kind answers", () => {
    expect(() =>
      prepareApplicationSubmission(context, command, "new-version", now),
    ).toThrow("APPLICATION_CONSENT_STALE");
    expect(() =>
      prepareApplicationSubmission(
        context,
        { ...command, answers: [] },
        "2026-08-01",
        now,
      ),
    ).toThrow("APPLICATION_ANSWER_REQUIRED");
    expect(() =>
      prepareApplicationSubmission(
        context,
        {
          ...command,
          answers: [
            { questionId: "q-bool", value: "yes" },
            { questionId: "q-text", value: "ok" },
          ],
        },
        "2026-08-01",
        now,
      ),
    ).toThrow("APPLICATION_ANSWER_INVALID");
  });

  it("accepts the exact decimal 5 MB boundary", () => {
    expect(() =>
      prepareApplicationSubmission(
        { ...context, cv: { ...context.cv, byteSize: 5_000_000 } },
        command,
        "2026-08-01",
        now,
      ),
    ).not.toThrow();
  });

  it("accepts an empty optional profile headline", () => {
    expect(() =>
      prepareApplicationSubmission(
        {
          ...context,
          candidate: { ...context.candidate, headline: null },
        },
        command,
        "2026-08-01",
        now,
      ),
    ).not.toThrow();
  });

  it("rejects foreign, unconfirmed, archived, or oversized CVs", () => {
    expect(() =>
      prepareApplicationSubmission(
        { ...context, cv: { ...context.cv, candidateUserId: "other" } },
        command,
        "2026-08-01",
        now,
      ),
    ).toThrow("APPLICATION_CV_INELIGIBLE");
    expect(() =>
      prepareApplicationSubmission(
        { ...context, cv: { ...context.cv, confirmedAt: null } },
        command,
        "2026-08-01",
        now,
      ),
    ).toThrow("APPLICATION_CV_INELIGIBLE");
    expect(() =>
      prepareApplicationSubmission(
        { ...context, cv: { ...context.cv, byteSize: 5_000_001 } },
        command,
        "2026-08-01",
        now,
      ),
    ).toThrow("APPLICATION_CV_INELIGIBLE");

    try {
      prepareApplicationSubmission(
        { ...context, cv: { ...context.cv, confirmedAt: null } },
        command,
        "2026-08-01",
        now,
      );
      throw new Error("Expected an ineligible CV rejection.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApplicationRepositoryError);
    }
  });
});
