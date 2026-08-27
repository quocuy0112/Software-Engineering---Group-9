"use client";

import type { z } from "zod";

import { cvEvidenceSchema } from "@/shared/contracts/cv-import/review";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvCopy } from "../i18n/cv-import-copy";
import styles from "./cv-evidence.module.css";

type Evidence = z.infer<typeof cvEvidenceSchema>;

export function CvEvidence({ evidence }: { evidence: Evidence }) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).review;
  const unavailable =
    evidence.confidence === null && evidence.locations.length === 0;
  return (
    <div
      className={styles.root}
      role="note"
      aria-label={
        evidence.reviewRequired
          ? locale === "vi"
            ? "Dữ liệu trích xuất cần được xem xét"
            : "Extracted CV data requiring review"
          : locale === "vi"
            ? "Dữ liệu trích xuất đã xác minh"
            : "Verified extracted CV data"
      }
    >
      <strong>{copy.evidence}</strong>
      {unavailable ? (
        <p className={styles.unavailable}>{copy.provenanceUnavailable}</p>
      ) : (
        <dl className={styles.details}>
          <div>
            <dt>{copy.confidence}</dt>
            <dd>
              {evidence.confidence === null
                ? copy.provenanceUnavailable.replace(
                    "Provenance",
                    locale === "vi" ? "Dữ liệu" : "Evidence",
                  )
                : `${Math.round(evidence.confidence * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>{copy.verifiedLocation}</dt>
            <dd>
              {evidence.locations.length
                ? evidence.locations.join(", ")
                : copy.provenanceUnavailable.replace(
                    "Provenance",
                    locale === "vi" ? "Dữ liệu" : "Evidence",
                  )}
            </dd>
          </div>
        </dl>
      )}
      <p className={styles.context}>
        {evidence.contextAvailable && evidence.context
          ? evidence.context
          : copy.sourceContextUnavailable}
      </p>
      {evidence.sourceLocations?.length || evidence.sourceMethods?.length ? (
        <details className={styles.technicalDetails}>
          <summary>{copy.sourceDetails}</summary>
          {evidence.sourceLocations?.length ? (
            <p>
              {copy.source}: {evidence.sourceLocations.join(", ")}
            </p>
          ) : null}
          {evidence.sourceMethods?.length ? (
            <p>
              {copy.extractionMethod}:{" "}
              {evidence.sourceMethods
                .map(
                  (method) =>
                    copy.sourceMethodLabels[method] ??
                    (locale === "vi" ? copy.unknownWarning : method),
                )
                .join(", ")}
            </p>
          ) : null}
        </details>
      ) : null}
      {evidence.reviewRequired ? (
        <div
          role="alert"
          aria-label={
            locale === "vi"
              ? "Cần kiểm tra dữ liệu nhận dạng"
              : "Recognized text requires review"
          }
        >
          <strong>
            {locale === "vi"
              ? "Kiểm tra lại nội dung này"
              : "Review this extracted content"}
          </strong>
          <p>
            {evidence.warnings?.length
              ? evidence.warnings
                  .map(
                    (warning) =>
                      copy.warningLabels[warning] ?? copy.unknownWarning,
                  )
                  .join(", ")
              : locale === "vi"
                ? "Độ tin cậy của nội dung nhận dạng cần được xác nhận."
                : "Recognition confidence requires confirmation."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
