import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { AccountIdentityService } from "@/backend/services/account/account-identity-service";
import { ProfileAccountView } from "@/frontend/features/profile/components/profile-account-view";

export default async function ProfileAccountPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Faccount");
  const identity = await new AccountIdentityService().get(context.userId);
  return (
    <ProfileAccountView
      initialIdentity={identity}
      csrfProof={context.csrfProof}
    />
  );
}
