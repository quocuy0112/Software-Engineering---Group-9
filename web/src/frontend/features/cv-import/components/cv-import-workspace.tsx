"use client";

import Link from "next/link";

import { useCvImport } from "../client/use-cv-import";
import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import { CvImportList } from "./cv-import-list";
import { CvUploadForm } from "./cv-upload-form";
import styles from "./cv-import-workspace.module.css";

export function CvImportWorkspace({
  csrfProof,
  initialItems,
  parserAvailability,
}: {
  csrfProof: string;
  initialItems: readonly CvImportSummary[];
  parserAvailability: Readonly<{
    deterministic: boolean;
    external: boolean;
  }>;
}) {
  const importer = useCvImport({ csrfProof });
  return (
    <div className={styles.root}>
      <section
        className={styles.uploadPanel}
        aria-labelledby="cv-upload-heading"
      >
        <header className={styles.sectionHeading}>
          <div>
            <p>NEW IMPORT</p>
            <h2 id="cv-upload-heading">Upload your CV</h2>
          </div>
          <span>Encrypted temporary storage</span>
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
          aria-label="CV import progress"
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
            Open import status <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <section
        className={styles.historyPanel}
        aria-labelledby="cv-import-history-heading"
      >
        <header className={styles.sectionHeading}>
          <div>
            <p>RECENT ACTIVITY</p>
            <h2 id="cv-import-history-heading">Import history</h2>
          </div>
          <span>{initialItems.length} retained</span>
        </header>
        <CvImportList items={initialItems} />
      </section>
    </div>
  );
}
