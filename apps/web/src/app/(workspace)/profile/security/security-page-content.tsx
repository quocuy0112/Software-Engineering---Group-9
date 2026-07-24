import { redirect } from "next/navigation";
import { ProfileSecurity } from "@/components/auth/profile-security";
import { ProfileNavigation } from "@/components/auth/profile-navigation";
import { getWorkspaceContext } from "@/server/auth/get-workspace-context";

export default async function ProfileSecurityPageContent() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fprofile%2Fsecurity");
  const { account } = context;

  return (
    <div className="profile-page profile-page--standalone">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">ACCOUNT &amp; ACCESS</p>
          <h1 id="workspace-page-title">Security</h1>
          <p className="page-heading-copy">
            Confirm your password before changing high-impact settings.
          </p>
        </div>
        <span className="page-heading-badge page-heading-badge--secure">
          {account.twoFactorEnabled ? "2FA enabled" : "2FA not enabled"}
        </span>
      </header>
      <ProfileNavigation active="security" />
      <ProfileSecurity
        initialTwoFactorEnabled={account.twoFactorEnabled}
        recoveryCompleted={context.recoveryCompleted}
      />
    </div>
  );
}
