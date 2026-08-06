import Link from "next/link";
import type { z } from "zod";

import { cvConfirmationReceiptSchema } from "@/shared/contracts/cv-import/review";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvCopy, cvFormatDateTime } from "../i18n/cv-import-copy";
import styles from "./cv-confirmation-receipt.module.css";

type Receipt = z.infer<typeof cvConfirmationReceiptSchema>;

export function CvConfirmationReceipt({ receipt }: { receipt: Receipt }) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).review;
  const groupLabels: Record<string, string> =
    locale === "vi"
      ? {
          scalars: "Chi tiết cơ bản",
          experiences: "Kinh nghiệm",
          education: "Học vấn",
          skills: "Kỹ năng",
          socialLinks: "Liên kết mạng xã hội",
        }
      : {
          scalars: "Profile details",
          experiences: "Experience",
          education: "Education",
          skills: "Skills",
          socialLinks: "Social links",
        };
  return (
    <section className={styles.root} aria-labelledby="cv-receipt-heading">
      <h2 id="cv-receipt-heading">{copy.receipt}</h2>
      <p role="status">
        {copy.applied} <strong>{receipt.profileRevisionAfter}</strong>.
      </p>
      <dl className={styles.counts} aria-label={copy.appliedCounts}>
        {Object.entries(receipt.appliedCounts).map(([group, count]) => (
          <div key={group}>
            <dt>{groupLabels[group] ?? group}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.metadata}>
        {locale === "vi" ? "Biên nhận" : "Receipt"} {receipt.receiptId};{" "}
        {locale === "vi" ? "xác nhận lúc" : "confirmed"}{" "}
        <time dateTime={receipt.confirmedAt}>
          {cvFormatDateTime(locale, receipt.confirmedAt)}
        </time>
      </p>
      <Link href="/profile">{copy.openCandidateProfile}</Link>
    </section>
  );
}
