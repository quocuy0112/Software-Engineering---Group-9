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
        <p>No CV imports yet.</p>
        <p>
          You may upload up to ten retained CV imports within your storage
          quota.
        </p>
      </div>
    );
  return (
    <ul className={styles.list} aria-label="CV imports">
      {items.map((item) => (
        <li key={item.uploadId} className={styles.item}>
          <div>
            <strong>{item.displayFilename ?? "CV filename removed"}</strong>
            <span>
              {item.documentKind} · {item.status.replaceAll("_", " ")}
            </span>
          </div>
          <Link href={`/profile/cv-imports/${item.uploadId}`}>View status</Link>
        </li>
      ))}
    </ul>
  );
}
