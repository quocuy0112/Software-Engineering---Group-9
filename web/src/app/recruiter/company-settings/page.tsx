import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterCompanySettings } from "@/backend/services/jobs/recruiter-job-posting-data";
import { CompanySettingsScreen } from "@/frontend/features/recruiter-workspace/company-settings-screen";

export const dynamic = "force-dynamic";

export default async function RecruiterCompanySettingsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fcompany-settings");
  const company = await readRecruiterCompanySettings(context.userId);
  return <CompanySettingsScreen initialCompany={company} />;
}
