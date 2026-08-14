import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { EligibleContext } from "@/shared/contracts/messaging/common";

/**
 * The API only supplies a job title and company name for application contexts.
 * Professional connections intentionally have no job-specific context.
 */
export function getJobContextLabel(context: EligibleContext): string | null {
  const jobTitle = context.jobTitle?.trim();
  const companyName = context.companyName?.trim();
  return jobTitle && companyName ? `${jobTitle} · ${companyName}` : null;
}

export function getConversationContextLabel(
  context: EligibleContext,
  locale: WorkspaceLocale = "en",
): string {
  return (
    getJobContextLabel(context) ??
    (locale === "vi" ? "Kết nối chuyên nghiệp" : "Professional connection")
  );
}
