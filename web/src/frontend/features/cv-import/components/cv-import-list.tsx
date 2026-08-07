"use client";

import Link from "next/link";

import type { CvImportSummary } from "@/shared/contracts/cv-import/upload";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvFormatDate, cvStatusLabel } from "../i18n/cv-import-copy";
import styles from "./cv-import-list.module.css";

type CvImportListItem = Omit<CvImportSummary, "uploadId"> & {
  uploadId: string;
};

export function CvImportList({
  items,
}: {
  items: readonly CvImportListItem[];
}) {
  const locale = useWorkspaceLocale();
  if (!items.length)
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          CV
        </span>
        <div>
          <strong>
            {locale === "vi"
              ? "Chưa có lần nhập CV nào."
              : "No CV imports yet."}
          </strong>
          <p>
            {locale === "vi"
              ? "Các tệp bạn tải lên và trạng thái xử lý sẽ xuất hiện ở đây. Bạn có thể lưu tối đa mười lần nhập trong hạn mức lưu trữ."
              : "Your uploads and their processing status will appear here. You may retain up to ten imports within your storage quota."}
          </p>
        </div>
      </div>
    );
  return (
    <ul
      className={styles.list}
      aria-label={locale === "vi" ? "Các lần nhập CV" : "CV imports"}
    >
      {items.map((item) => (
        <li key={item.uploadId} className={styles.item}>
          <div className={styles.document}>
            <span className={styles.documentIcon} aria-hidden="true">
              {item.documentKind}
            </span>
            <div className={styles.documentCopy}>
              <strong>{item.displayFilename ?? "CV filename removed"}</strong>
              <span>
                {locale === "vi" ? "Tạo vào" : "Created"}{" "}
                <time dateTime={item.createdAt}>
                  {cvFormatDate(locale, item.createdAt, {
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
              {cvStatusLabel(locale, item.status)}
            </span>
            <Link href={`/profile/cv-imports/${item.uploadId}`}>
              {locale === "vi" ? "Xem trạng thái" : "View status"}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
