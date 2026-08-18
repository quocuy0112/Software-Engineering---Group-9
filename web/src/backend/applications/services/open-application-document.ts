import "server-only";

import { PrismaApplicationRepository } from "@/backend/repositories/applications/prisma-application-repository";
import type { ApplicationRepositoryPort } from "@/backend/repositories/applications/application-repository";
import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { RecruiterApplicationAuthorization } from "../authorization/recruiter-application-authorization";
import { createApplicationDocumentStorage } from "../storage/factory";
import type { ApplicationDocumentStoragePort } from "../storage/application-document-storage";

export class OpenApplicationDocumentError extends Error {
  constructor(readonly code: "UNAVAILABLE" | "PREVIEW_UNAVAILABLE") {
    super(code);
  }
}

export class OpenApplicationDocumentService {
  constructor(
    private readonly repository: ApplicationRepositoryPort =
      new PrismaApplicationRepository(),
    private readonly authorization = new RecruiterApplicationAuthorization(),
    private readonly storage?: ApplicationDocumentStoragePort,
    private readonly stageService = new ApplicationStageService(),
  ) {}

  private async markViewed(input: {
    userId: string;
    sessionId?: string;
    applicationId: string;
    document: Awaited<ReturnType<ApplicationRepositoryPort["findDocument"]>>;
    now?: Date;
  }) {
    const document = input.document;
    if (
      !input.sessionId ||
      !document ||
      document.stage !== "APPLIED" ||
      document.stageVersion === undefined
    ) {
      return;
    }
    try {
      await this.stageService.transition(
        { userId: input.userId, sessionId: input.sessionId },
        input.applicationId,
        {
          targetStage: "VIEWED",
          expectedVersion: document.stageVersion,
        },
        input.now,
      );
    } catch (error) {
      // A drawer loads CV and cover-letter previews concurrently, and the
      // ranking list also acknowledges the same view. One of those requests
      // may win the APPLIED -> VIEWED transition; the losing request must not
      // make an otherwise authorized document unavailable.
      if (error instanceof JobServiceError && [404, 409].includes(error.status)) {
        return;
      }
      throw error;
    }
  }

  async execute(input: {
    userId: string;
    sessionId?: string;
    jobId: string;
    applicationId: string;
    kind: "cv" | "cover-letter";
    preview: boolean;
    now?: Date;
  }) {
    const auth = await this.authorization.authorizeApplication(
      input.userId,
      input.jobId,
      input.applicationId,
    );
    if (!auth.authorized) throw new OpenApplicationDocumentError("UNAVAILABLE");
    const document = await this.repository.findDocument(input);
    if (!document) throw new OpenApplicationDocumentError("UNAVAILABLE");
    if (input.preview && !document.previewSupported) {
      throw new OpenApplicationDocumentError("PREVIEW_UNAVAILABLE");
    }
    await this.markViewed({
      userId: input.userId,
      sessionId: input.sessionId,
      applicationId: input.applicationId,
      document,
      now: input.now,
    });
    if (document.text !== null) {
      return Object.freeze({ document, stream: null });
    }
    if (!document.storageKey) {
      throw new OpenApplicationDocumentError("UNAVAILABLE");
    }
    try {
      const storage = this.storage ?? createApplicationDocumentStorage();
      await storage.assertReady();
      const source = storage.open(
        document.storageKey,
        document.byteLength,
      );
      const iterator = source[Symbol.asyncIterator]();
      const first = await iterator.next();
      const stream = (async function* () {
        try {
          if (!first.done) yield first.value;
          while (true) {
            const next = await iterator.next();
            if (next.done) return;
            yield next.value;
          }
        } finally {
          await iterator.return?.();
        }
      })();
      return Object.freeze({ document, stream });
    } catch {
      throw new OpenApplicationDocumentError("UNAVAILABLE");
    }
  }
}
