import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ApplicationRepositoryPort } from "@/backend/repositories/jobs/prisma-job-application-repository";
import {
  ApplicationRepositoryError,
  ACTIVE_APPLICATION_CONSENT_VERSION,
} from "./application-policy";
import {
  applicationSubmissionSchema,
  idempotencyKeySchema,
  type ApplicationSubmission,
} from "@/shared/contracts/jobs/actions";
import { JobServiceError, type CandidateActor } from "./job-types";

function binding(command: ApplicationSubmission) {
  const stable = {
    ...command,
    answers: [...command.answers].sort((a, b) =>
      a.questionId.localeCompare(b.questionId),
    ),
  };
  return createHash("sha256")
    .update(JSON.stringify(stable), "utf8")
    .digest("hex");
}

function applicationFailureMessage(code: string) {
  switch (code) {
    case "APPLICATION_PROFILE_INCOMPLETE":
      return "Complete your profile headline and location before applying.";
    case "APPLICATION_CV_INELIGIBLE":
      return "Select a confirmed CV. If you just imported a CV, confirm its review and reopen Apply.";
    case "APPLICATION_ANSWER_REQUIRED":
      return "Answer all required employer questions before applying.";
    case "APPLICATION_ANSWER_INVALID":
    case "APPLICATION_ANSWER_UNKNOWN":
    case "APPLICATION_ANSWER_DUPLICATE":
      return "Review the answers in this application before applying.";
    case "APPLICATION_CONSENT_STALE":
      return "Accept the application consent before applying.";
    case "APPLICATION_TEXT_TOO_LONG":
      return "Shorten the application text before applying.";
    default:
      return "Complete the required profile, CV, answers, and consent before applying.";
  }
}

export class JobApplicationService {
  constructor(
    private readonly repository?: ApplicationRepositoryPort,
    private readonly csrfTokenFactory?: (
      sessionId: string,
    ) => string | Promise<string>,
  ) {}

  private async repo() {
    return (
      this.repository ??
      new (
        await import("@/backend/repositories/jobs/prisma-job-application-repository")
      ).PrismaJobApplicationRepository()
    );
  }

  private async createCsrfToken(sessionId: string) {
    if (this.csrfTokenFactory) return this.csrfTokenFactory(sessionId);
    return (await import("@/backend/security/csrf/csrf-proof")).csrfProof(
      sessionId,
    );
  }

  async form(actor: CandidateActor, jobId: string, now = new Date()) {
    const result = await (
      await this.repo()
    ).getCandidateForm(actor.userId, jobId, now);
    if (!result)
      throw new JobServiceError(404, {
        code: "JOB_UNAVAILABLE",
        message: "This job is not available.",
      });
    if (result.existingApplication)
      throw new JobServiceError(409, {
        code: "APPLICATION_EXISTS",
        message: "You already applied to this job.",
      });
    return {
      jobId: result.job.id,
      jobTitle: result.job.title,
      jobLocation: result.job.location,
      companyName: result.job.company.displayName,
      profileReady: result.profileReady,
      missingProfileFields: result.missingProfileFields,
      profileRevision: result.profileRevision,
      profileBasics: result.profileBasics,
      contact: result.contact,
      cvs: result.cvs.map((cv) => ({
        ...cv,
        confirmedAt: cv.confirmedAt.toISOString(),
      })),
      questions: result.questions,
      consentVersion: ACTIVE_APPLICATION_CONSENT_VERSION,
      csrfToken: await this.createCsrfToken(actor.sessionId),
    };
  }

  async submit(
    actor: CandidateActor,
    jobId: string,
    idempotencyKey: string,
    raw: unknown,
    now = new Date(),
  ) {
    const command = applicationSubmissionSchema.parse(raw);
    const key = idempotencyKeySchema.parse(idempotencyKey);
    try {
      const result = await (
        await this.repo()
      ).submit({
        candidateUserId: actor.userId,
        sessionId: actor.sessionId,
        jobId,
        idempotencyKey: key,
        submissionBindingDigest: binding(command),
        command,
        activeConsentVersion: ACTIVE_APPLICATION_CONSENT_VERSION,
        occurredAt: now,
        correlationId: randomUUID(),
      });
      return { ...result.application, created: result.created };
    } catch (error) {
      if (error instanceof ApplicationRepositoryError) {
        const conflict = [
          "IDEMPOTENCY_KEY_REUSED",
          "JOB_NO_LONGER_ACCEPTING_APPLICATIONS",
        ].includes(error.code);
        throw new JobServiceError(conflict ? 409 : 403, {
          code: error.code,
          message: conflict
            ? "The application could not be submitted in its current state."
            : applicationFailureMessage(error.code),
        });
      }
      throw error;
    }
  }
}
