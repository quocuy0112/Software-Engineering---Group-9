"use client";

import type { CvParserClass } from "@/shared/contracts/cv-import/common";
import { cvProcessingNotice } from "@/shared/contracts/cv-import/upload";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvProcessingNoticeText } from "../i18n/cv-import-copy";
import styles from "./cv-processing-notice.module.css";

export function CvProcessingNotice({
  parserClass,
}: {
  parserClass: CvParserClass;
}) {
  const notice = cvProcessingNotice(parserClass);
  const locale = useWorkspaceLocale();
  return (
    <aside
      className={styles.notice}
      role="note"
      data-notice-version={notice.noticeVersion}
    >
      <strong>
        {locale === "vi"
          ? "Cách CV của bạn được xử lý"
          : "How your CV is processed"}
      </strong>
      <p>{cvProcessingNoticeText(locale, parserClass) || notice.noticeText}</p>
    </aside>
  );
}
