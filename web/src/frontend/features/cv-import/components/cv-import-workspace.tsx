"use client";

import Link from "next/link";

import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { useCvImport } from "../client/use-cv-import";
import type { CandidateCvSummary } from "@/shared/contracts/cv-import/candidate-cv";
import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import { cvCopy } from "../i18n/cv-import-copy";
import { CandidateCvLibrary } from "./candidate-cv-library";
import { CvImportList } from "./cv-import-list";
import { CvUploadForm } from "./cv-upload-form";
import styles from "./cv-import-workspace.module.css";

export function CvImportWorkspace({
  csrfProof,
  initialItems,
  initialCandidateCvs = [],
  parserAvailability,
}: {
  csrfProof: string;
  initialItems: readonly CvImportSummary[];
  initialCandidateCvs?: readonly CandidateCvSummary[];
  parserAvailability: Readonly<{
    deterministic: boolean;
    external: boolean;
  }>;
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale);
  const importer = useCvImport({ csrfProof });
  return (
    <div className={styles.root}>
      <section
        className={styles.uploadPanel}
        aria-labelledby="cv-upload-heading"
      >
        <header className={styles.sectionHeading}>
          <div>
            <p>{locale === "vi" ? "NHẬP MỚI" : "NEW IMPORT"}</p>
            <h2 id="cv-upload-heading">
              {locale === "vi" ? "Tải CV của bạn lên" : "Upload your CV"}
            </h2>
          </div>
          <span>
            {locale === "vi"
              ? "Lưu trữ tạm thời được mã hóa"
              : "Encrypted temporary storage"}
          </span>
        </header>
        <CvUploadForm
          csrfProof={csrfProof}
          parserAvailability={parserAvailability}
          onUpload={(file, parserClass) => importer.upload(file, parserClass)}
        />
      </section>

      <div
        className={styles.workflowProgress}
        data-state={importer.progress.state}
        data-parser={importer.progress.parserClass ?? "NONE"}
      >
        <span className={styles.progressIcon} aria-hidden="true" />
        <p className={styles.workflowStatus} role="status" aria-live="polite">
          <strong>{importer.progress.title}</strong>
          <span>{importer.progress.message}</span>
        </p>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label={
            locale === "vi" ? "Tiến trình nhập CV" : "CV import progress"
          }
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={importer.progress.percentage}
        >
          <span style={{ width: `${importer.progress.percentage}%` }} />
        </div>
        {importer.progress.uploadId ? (
          <Link
            className={styles.statusLink}
            href={`/profile/cv-imports/${importer.progress.uploadId}`}
          >
            {locale === "vi" ? "Mở trạng thái nhập" : "Open import status"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <CandidateCvLibrary
        csrfProof={csrfProof}
        initialItems={initialCandidateCvs}
      />

      <section
        className={styles.historyPanel}
        aria-labelledby="cv-import-history-heading"
      >
        <header className={styles.sectionHeading}>
          <div>
            <p>{locale === "vi" ? "HOẠT ĐỘNG GẦN ĐÂY" : "RECENT ACTIVITY"}</p>
            <h2 id="cv-import-history-heading">{copy.common.importHistory}</h2>
          </div>
          <span>
            {locale === "vi"
              ? `${initialItems.length} được lưu giữ`
              : `${initialItems.length} retained`}
          </span>
        </header>
        <CvImportList items={initialItems} />
      </section>
    </div>
  );
}
