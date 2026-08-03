"use client";

import { useCvImport } from "../client/use-cv-import";
import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import { CvImportList } from "./cv-import-list";
import { CvUploadForm } from "./cv-upload-form";

export function CvImportPage({
  csrfProof,
  initialItems,
}: {
  csrfProof: string;
  initialItems: readonly CvImportSummary[];
}) {
  const importer = useCvImport({ csrfProof });
  return (
    <>
      <CvUploadForm
        csrfProof={csrfProof}
        onUpload={(file, parserClass) => importer.upload(file, parserClass)}
      />
      <p role="status" aria-live="polite">
        {importer.progress.message}
      </p>
      <section aria-labelledby="cv-import-history-heading">
        <h2 id="cv-import-history-heading">Import history</h2>
        <CvImportList items={initialItems} />
      </section>
    </>
  );
}
