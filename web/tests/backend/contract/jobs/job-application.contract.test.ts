import { describe, expect, it } from "vitest";
import {
  applicationFormSchema,
  applicationOutcomeSchema,
} from "@/shared/contracts/jobs/actions";
import { JobApplicationService } from "@/backend/services/jobs/job-application-service";

describe("application form and submission contracts", () => {
  it("projects only owned confirmed CV metadata and active questions", async () => {
    const repository = {
      getCandidateForm: async () => ({
        job: {
          id: "job-1",
          title: "Engineer",
          location: "TP Hồ Chí Minh",
          company: { displayName: "Company" },
        },
        profileReady: true,
        missingProfileFields: [],
        profileRevision: 1,
        profileBasics: {
          headline: "Engineer",
          summary: null,
          phone: null,
          location: "TP Hồ Chí Minh",
        },
        cvs: [
          {
            id: "cv-1",
            displayName: "CV",
            fileName: "cv.pdf",
            mimeType: "application/pdf" as const,
            byteSize: 1000,
            version: 1,
            confirmedAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
        questions: [],
        existingApplication: null,
      }),
      submit: async () => {
        throw new Error("not used");
      },
    };
    const form = await new JobApplicationService(
      repository,
      () => "contract-csrf-token",
    ).form({ userId: "user-1", sessionId: "session-1" }, "job-1");
    expect(applicationFormSchema.parse(form).cvs[0]).not.toHaveProperty(
      "storageKey",
    );
  });

  it("returns the strict idempotent outcome", async () => {
    const repository = {
      getCandidateForm: async () => null,
      submit: async () => ({
        application: {
          applicationId: "application-1",
          jobId: "job-1",
          stage: "APPLIED" as const,
          submittedAt: "2026-08-01T00:00:00.000Z",
          created: true,
          message: "Application submitted.",
        },
        created: true,
      }),
    };
    const result = await new JobApplicationService(repository).submit(
      { userId: "user-1", sessionId: "session-1" },
      "job-1",
      "application-key-00000001",
      {
        cvId: "cv-1",
        answers: [],
        coverLetter: null,
        consentVersion: "2026-08-01",
        consentAccepted: true,
      },
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(applicationOutcomeSchema.parse(result)).toMatchObject({
      stage: "APPLIED",
    });
  });

  it("rejects a form when the candidate has exhausted this job's attempts", async () => {
    const repository = {
      getCandidateForm: async () => ({
        job: {
          id: "job-1",
          title: "Engineer",
          location: "TP Hô Chi Minh",
          company: { displayName: "Company" },
        },
        profileReady: true,
        missingProfileFields: [],
        profileRevision: 1,
        profileBasics: {
          headline: "Engineer",
          summary: null,
          phone: null,
          location: "TP Hô Chi Minh",
        },
        cvs: [],
        questions: [],
        existingApplication: null,
        applicationCount: 5,
      }),
      submit: async () => {
        throw new Error("not used");
      },
    };

    await expect(
      new JobApplicationService(repository).form(
        { userId: "user-1", sessionId: "session-1" },
        "job-1",
      ),
    ).rejects.toMatchObject({
      status: 409,
      body: {
        code: "APPLICATION_MAX_ATTEMPTS",
      },
    });
  });
});
