import Link from "next/link";
import type { z } from "zod";

import { cvConfirmationReceiptSchema } from "@/shared/contracts/cv-import/review";
import styles from "./cv-confirmation-receipt.module.css";

type Receipt = z.infer<typeof cvConfirmationReceiptSchema>;

export function CvConfirmationReceipt({ receipt }: { receipt: Receipt }) {
  return (
    <section className={styles.root} aria-labelledby="cv-receipt-heading">
      <h2 id="cv-receipt-heading">CV import confirmed</h2>
      <p role="status">
        Selected changes were applied to Candidate Profile revision{" "}
        <strong>{receipt.profileRevisionAfter}</strong>.
      </p>
      <dl className={styles.counts} aria-label="Applied change counts">
        {Object.entries(receipt.appliedCounts).map(([group, count]) => (
          <div key={group}>
            <dt>{group}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.metadata}>
        Receipt {receipt.receiptId}; confirmed{" "}
        <time dateTime={receipt.confirmedAt}>
          {new Date(receipt.confirmedAt).toLocaleString()}
        </time>
      </p>
      <Link href="/profile">Open Candidate Profile</Link>
    </section>
  );
}
