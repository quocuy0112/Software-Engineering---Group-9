import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { ProfileOverview } from "@/frontend/features/profile/components/profile-overview";

export default async function ProfilePage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile");

  return (
    <ProfileOverview
      account={{
        name: context.account.name,
        email: context.account.email,
        memberSince: context.account.createdAt.toLocaleDateString(),
        twoFactorEnabled: context.account.twoFactorEnabled,
      }}
    />
  );
}
