import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterCompanySettings } from "@/backend/services/jobs/recruiter-job-posting-data";
import { CompanySettingsScreen } from "@/frontend/features/recruiter-workspace/company-settings-screen";
import { requireActiveCompanyOwner } from "@/backend/company-members/company-team-authorization";

export const dynamic = "force-dynamic";

export default async function RecruiterCompanySettingsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fcompany-settings");
  const company = await readRecruiterCompanySettings(context.userId);
  let canManageTeam = false;
  try { await requireActiveCompanyOwner(context.userId); canManageTeam = true; } catch { /* Owner-only navigation is intentionally absent. */ }
  return <CompanySettingsScreen initialCompany={company} canManageTeam={canManageTeam} />;
}
