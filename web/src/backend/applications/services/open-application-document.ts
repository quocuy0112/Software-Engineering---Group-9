import "server-only";

import { PrismaApplicationRepository } from "@/backend/repositories/applications/prisma-application-repository";
import type { ApplicationRepositoryPort } from "@/backend/repositories/applications/application-repository";
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
  ) {}

  async execute(input: {
    userId: string;
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
    const document = await this.repository.findDocument({
      ...input,
      jobId: auth.jobPostingId,
    });
    if (!document) throw new OpenApplicationDocumentError("UNAVAILABLE");
    if (input.preview && !document.previewSupported) {
      throw new OpenApplicationDocumentError("PREVIEW_UNAVAILABLE");
    }
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
