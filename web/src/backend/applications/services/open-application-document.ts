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
    const document = await this.repository.findDocument(input);
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
      const stream = storage.open(
        document.storageKey,
        document.byteLength,
      );
      return Object.freeze({ document, stream });
    } catch {
      throw new OpenApplicationDocumentError("UNAVAILABLE");
    }
  }
}
