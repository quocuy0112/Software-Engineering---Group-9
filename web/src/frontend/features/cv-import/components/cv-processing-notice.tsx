import type { CvParserClass } from "@/shared/contracts/cv-import/common";
import { cvProcessingNotice } from "@/shared/contracts/cv-import/upload";
import styles from "./cv-processing-notice.module.css";

export function CvProcessingNotice({
  parserClass,
}: {
  parserClass: CvParserClass;
}) {
  const notice = cvProcessingNotice(parserClass);
  return (
    <aside
      className={styles.notice}
      role="note"
      data-notice-version={notice.noticeVersion}
    >
      <strong>How your CV is processed</strong>
      <p>{notice.noticeText}</p>
    </aside>
  );
}
