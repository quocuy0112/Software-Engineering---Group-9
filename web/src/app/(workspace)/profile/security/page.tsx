import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { ProfileSecurityView } from "@/frontend/features/profile/components/profile-security-view";

export default async function ProfileSecurityPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fsecurity");

  return (
    <ProfileSecurityView
      twoFactorEnabled={context.account.twoFactorEnabled}
      recoveryCompleted={context.recoveryCompleted}
      csrfProof={context.csrfProof}
    />
  );
}
