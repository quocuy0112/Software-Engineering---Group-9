"use client";

import type { LimitedPrivateReport } from "@/shared/contracts/private-cv-match";
import { PrivateMatchReport } from "./private-match-report";

export function PrivateMatchLimitedReport({
  checkId,
  report,
  onRetry,
  retrying = false,
  retryError,
}: {
  checkId: string;
  report: LimitedPrivateReport;
  onRetry: () => void;
  retrying?: boolean;
  retryError?: string;
}) {
  return (
    <PrivateMatchReport
      checkId={checkId}
      report={report}
      onRetry={onRetry}
      retrying={retrying || report.retryInProgress}
      retryError={retryError}
    />
  );
}
