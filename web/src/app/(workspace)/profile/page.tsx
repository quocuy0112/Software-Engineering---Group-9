import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { ProfileOverview } from "@/frontend/features/profile/components/profile-overview";

export default async function ProfilePage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile");

  const profile = await new GetProfileAggregateService().execute(
    context.userId,
  );

  return (
    <ProfileOverview
      account={{
        id: context.userId,
        name: context.account.name,
        email: context.account.email,
        image: context.account.image,
        memberSince: context.account.createdAt.toLocaleDateString(),
        twoFactorEnabled: context.account.twoFactorEnabled,
      }}
      initialProfile={profile}
      csrfProof={context.csrfProof}
    />
  );
}
