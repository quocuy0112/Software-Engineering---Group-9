import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { AccountPreferencesService } from "@/backend/services/account/account-preferences-service";
import { ProfilePreferencesView } from "@/frontend/features/profile/components/profile-preferences-view";

export default async function ProfilePreferencesPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fpreferences");
  const preferences = await new AccountPreferencesService().get(context.userId);
  return (
    <ProfilePreferencesView
      initialPreferences={preferences}
      csrfProof={context.csrfProof}
    />
  );
}
