"use client";

import Link from "next/link";

import { Panel } from "@/frontend/components/ui/design-system";
import { StatusStrip } from "@/frontend/components/ui/cv-import-primitives";
import type { CandidateCvSummary } from "@/shared/contracts/cv-import/candidate-cv";
import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { useCvImport } from "../client/use-cv-import";
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
  parserAvailability: Readonly<{ deterministic: boolean; external: boolean }>;
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale);
  const importer = useCvImport({ csrfProof });
  const savedLabel = locale === "vi" ? `${initialCandidateCvs.length} đã lưu` : `${initialCandidateCvs.length} saved`;
  const retainedLabel = locale === "vi" ? `${initialItems.length} được lưu giữ` : `${initialItems.length} retained`;

  return (
    <div className={styles.root}>
      <Panel
        eyebrow={locale === "vi" ? "Nhập mới" : "New import"}
        title={locale === "vi" ? "Tải CV của bạn lên" : "Upload your CV"}
        rightSlot={
          <span className="sh-count-pill">
            {locale === "vi" ? "Lưu trữ tạm thời được mã hóa" : "Encrypted temporary storage"}
          </span>
        }
        className={styles.panel}
        titleId="cv-upload-heading"
      >
        <CvUploadForm
          csrfProof={csrfProof}
          parserAvailability={parserAvailability}
          onUpload={(file, parserClass) => importer.upload(file, parserClass)}
        />
      </Panel>

      <StatusStrip
        title={importer.progress.title}
        description={importer.progress.message}
        progressPercent={importer.progress.percentage}
        state={importer.progress.state}
        action={
          importer.progress.uploadId ? (
            <Link
              className={styles.statusLink}
              href={`/profile/cv-imports/${importer.progress.uploadId}`}
            >
              {locale === "vi" ? "Mở trạng thái nhập" : "Open import status"}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null
        }
      />

      <Panel
        eyebrow={locale === "vi" ? "CV ứng tuyển" : "Application CVs"}
        title={locale === "vi" ? "CV đã lưu" : "Saved CVs"}
        rightSlot={<span className="sh-count-pill">{savedLabel}</span>}
        className={styles.panel}
        titleId="candidate-cv-library-heading"
      >
        <CandidateCvLibrary
          csrfProof={csrfProof}
          initialItems={initialCandidateCvs}
          embedded
        />
      </Panel>

      <Panel
        eyebrow={locale === "vi" ? "Hoạt động gần đây" : "Recent activity"}
        title={copy.common.importHistory}
        rightSlot={<span className="sh-count-pill">{retainedLabel}</span>}
        className={styles.panel}
        titleId="cv-import-history-heading"
      >
        <CvImportList items={initialItems} />
      </Panel>
    </div>
  );
}
