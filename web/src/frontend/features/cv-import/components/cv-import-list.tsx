import Link from "next/link";

import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import styles from "./cv-import-list.module.css";

type CvImportListItem = Omit<CvImportSummary, "uploadId"> & {
  uploadId: string;
};

export function CvImportList({
  items,
}: {
  items: readonly CvImportListItem[];
}) {
  if (!items.length)
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          CV
        </span>
        <div>
          <strong>No CV imports yet.</strong>
          <p>
            Your uploads and their processing status will appear here. You may
            retain up to ten imports within your storage quota.
          </p>
        </div>
      </div>
    );
  return (
    <ul className={styles.list} aria-label="CV imports">
      {items.map((item) => (
        <li key={item.uploadId} className={styles.item}>
          <div className={styles.document}>
            <span className={styles.documentIcon} aria-hidden="true">
              {item.documentKind}
            </span>
            <div className={styles.documentCopy}>
              <strong>{item.displayFilename ?? "CV filename removed"}</strong>
              <span>
                Created{" "}
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                    year: "numeric",
                  })}
                </time>
              </span>
            </div>
          </div>
          <div className={styles.itemActions}>
            <span className={styles.status} data-status={item.status}>
              {item.status.replaceAll("_", " ").toLowerCase()}
            </span>
            <Link href={`/profile/cv-imports/${item.uploadId}`}>
              View status <span aria-hidden="true">→</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
