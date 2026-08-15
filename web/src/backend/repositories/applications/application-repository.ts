import "server-only";

import type { ApplicationPage } from "@/shared/contracts/applications";

export type ApplicationDocumentRecord = Readonly<{
  applicationId: string;
  jobId: string;
  kind: "cv" | "cover-letter";
  fileName: string | null;
  mediaType: string | null;
  byteLength: number;
  storageKey: string | null;
  text: string | null;
  previewSupported: boolean;
}>;

export type ApplicationRepositoryPort = Readonly<{
  listSubmittedCandidates(input: {
    jobId: string;
    limit: number;
    cursor?: string;
    now?: Date;
  }): Promise<ApplicationPage>;
  findDocument(input: {
    jobId: string;
    applicationId: string;
    kind: "cv" | "cover-letter";
    now?: Date;
  }): Promise<ApplicationDocumentRecord | null>;
}>;
