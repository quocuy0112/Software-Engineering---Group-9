"use client";

import { InfoBanner } from "@/frontend/components/ui/cv-import-primitives";
import type { CvParserClass } from "@/shared/contracts/cv-import/common";
import { cvProcessingNotice } from "@/shared/contracts/cv-import/upload";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvProcessingNoticeText } from "../i18n/cv-import-copy";

export function CvProcessingNotice({
  parserClass,
}: {
  parserClass: CvParserClass;
}) {
  const notice = cvProcessingNotice(parserClass);
  const locale = useWorkspaceLocale();
  return (
    <InfoBanner
      icon={<span aria-hidden="true">i</span>}
      title={
        locale === "vi"
          ? "Cách CV của bạn được xử lý"
          : "How your CV is processed"
      }
      description={cvProcessingNoticeText(locale, parserClass) || notice.noticeText}
      data-notice-version={notice.noticeVersion}
    />
  );
}
