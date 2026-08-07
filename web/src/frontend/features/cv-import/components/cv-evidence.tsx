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
            ? "Bằng chứng của bộ phân tích cần được xem xét"
            : "Parser evidence requiring review"
          : locale === "vi"
            ? "Bằng chứng đã xác minh của bộ phân tích"
            : "Verified parser evidence"
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
      {evidence.sourceLocations?.length ? (
        <p>Source: {evidence.sourceLocations.join(", ")}</p>
      ) : null}
      {evidence.sourceMethods?.length ? (
        <p>Extraction: {evidence.sourceMethods.join(", ")}</p>
      ) : null}
      {evidence.reviewRequired ? (
        <div role="alert" aria-label="OCR evidence requires review">
          <strong>Review this OCR evidence</strong>
          <p>
            {evidence.warnings?.length
              ? evidence.warnings
                  .map((warning) => warning.replaceAll("_", " ").toLowerCase())
                  .join(", ")
              : "Recognition confidence requires confirmation."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
