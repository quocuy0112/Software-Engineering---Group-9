import type { z } from "zod";

import { cvEvidenceSchema } from "@/shared/contracts/cv-import/review";
import styles from "./cv-evidence.module.css";

type Evidence = z.infer<typeof cvEvidenceSchema>;

export function CvEvidence({ evidence }: { evidence: Evidence }) {
  const unavailable =
    evidence.confidence === null && evidence.locations.length === 0;
  return (
    <div
      className={styles.root}
      role="note"
      aria-label="Verified parser evidence"
    >
      <strong>Parser evidence</strong>
      {unavailable ? (
        <p className={styles.unavailable}>Provenance unavailable.</p>
      ) : (
        <dl className={styles.details}>
          <div>
            <dt>Confidence</dt>
            <dd>
              {evidence.confidence === null
                ? "Unavailable"
                : `${Math.round(evidence.confidence * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>Verified location</dt>
            <dd>
              {evidence.locations.length
                ? evidence.locations.join(", ")
                : "Unavailable"}
            </dd>
          </div>
        </dl>
      )}
      <p className={styles.context}>
        {evidence.contextAvailable && evidence.context
          ? evidence.context
          : "Source context unavailable."}
      </p>
    </div>
  );
}
