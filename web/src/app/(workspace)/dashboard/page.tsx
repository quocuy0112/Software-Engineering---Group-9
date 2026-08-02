import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { DashboardView } from "@/frontend/features/dashboard/components/dashboard-view";

export default async function DashboardPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fdashboard");
  const profile = await new GetProfileAggregateService().execute(
    context.userId,
  );

  return (
    <DashboardView
      account={{
        name: context.account.name,
        hasAvatar: Boolean(context.account.image),
        twoFactorEnabled: context.account.twoFactorEnabled,
      }}
      profile={profile}
    />
  );
}
