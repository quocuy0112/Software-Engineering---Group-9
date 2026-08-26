import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { ProfileSecurityView } from "@/frontend/features/profile/components/profile-security-view";

export default async function ProfileSecurityPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fsecurity");
  const profile = await new GetProfileAggregateService().execute(context.userId);

  return (
    <ProfileSecurityView
      twoFactorEnabled={context.account.twoFactorEnabled}
      recoveryCompleted={context.recoveryCompleted}
      csrfProof={context.csrfProof}
      initialProfile={profile}
    />
  );
}
