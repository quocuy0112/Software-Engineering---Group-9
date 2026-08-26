import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { ProfileAboutView } from "@/frontend/features/profile/components/profile-about-view";

export default async function ProfileAboutPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fabout");

  const profile = await new GetProfileAggregateService().execute(
    context.userId,
  );

  return (
    <ProfileAboutView
      initialProfile={profile}
      csrfProof={context.csrfProof}
    />
  );
}
