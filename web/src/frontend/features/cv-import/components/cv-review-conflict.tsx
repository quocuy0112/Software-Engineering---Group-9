import { useEffect, useRef } from "react";

import type { CvReviewConflict } from "../client/use-cv-draft-review";
import styles from "./cv-review-conflict.module.css";

export function CvReviewConflictPanel({
  conflict,
  unsavedSummary,
  unsavedPreview,
  latestCompared,
  pending,
  onCompareLatest,
  onReapplyLatest,
  onDiscardAndReload,
}: {
  conflict: CvReviewConflict;
  unsavedSummary: string;
  unsavedPreview: readonly { id: string; label: string; value: string }[];
  latestCompared: boolean;
  pending: boolean;
  onCompareLatest: () => void;
  onReapplyLatest: () => void;
  onDiscardAndReload: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section
      className={styles.root}
      aria-labelledby="cv-conflict-heading"
      aria-live="assertive"
    >
      <h2 id="cv-conflict-heading" ref={heading} tabIndex={-1}>
        Review conflict needs your choice
      </h2>
      <p role="alert">{conflict.message}</p>
      <p>{unsavedSummary} Your in-memory edits have not been overwritten.</p>
      {unsavedPreview.length ? (
        <section
          className={styles.preview}
          aria-labelledby="cv-unsaved-preview-heading"
        >
          <h3 id="cv-unsaved-preview-heading">
            Unsaved values kept in this browser memory
          </h3>
          <dl>
            {unsavedPreview.map((item) => (
              <div key={item.id}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {conflict.latest ? (
        <div className={styles.metadata}>
          <p>
            Latest saved draft revision {conflict.latest.draftRevision}; Profile
            revision {conflict.latest.profileRevision}.
          </p>
          {conflict.latest.draftUpdatedAt ? (
            <p>
              Draft updated{" "}
              <time dateTime={conflict.latest.draftUpdatedAt}>
                {conflict.latest.draftUpdatedAt}
              </time>
              .
            </p>
          ) : null}
          {conflict.latest.profileUpdatedAt ? (
            <p>
              Profile updated{" "}
              <time dateTime={conflict.latest.profileUpdatedAt}>
                {conflict.latest.profileUpdatedAt}
              </time>
              .
            </p>
          ) : null}
        </div>
      ) : null}
      <div className={styles.actions}>
        <button type="button" disabled={pending} onClick={onCompareLatest}>
          Compare with latest saved review
        </button>
        <button
          type="button"
          disabled={pending || !latestCompared}
          onClick={onReapplyLatest}
        >
          Reapply my edits to latest
        </button>
        <button type="button" disabled={pending} onClick={onDiscardAndReload}>
          Discard my edits and reload latest
        </button>
      </div>
    </section>
  );
}
