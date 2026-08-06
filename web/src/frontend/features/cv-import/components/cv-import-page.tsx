"use client";

import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { useCvImport } from "../client/use-cv-import";
import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import { CvImportList } from "./cv-import-list";
import { CvUploadForm } from "./cv-upload-form";
import { cvCopy } from "../i18n/cv-import-copy";

export function CvImportPage({
  csrfProof,
  initialItems,
}: {
  csrfProof: string;
  initialItems: readonly CvImportSummary[];
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale);
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
        <h2 id="cv-import-history-heading">{copy.common.importHistory}</h2>
        <CvImportList items={initialItems} />
      </section>
    </>
  );
}
