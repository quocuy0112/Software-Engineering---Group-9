import { ProfileNavigation } from "./profile-navigation";
import { ProfileSecurity } from "./profile-security";
import { Badge } from "@/frontend/components/ui/badge";

type ProfileSecurityViewProps = {
  twoFactorEnabled: boolean;
  recoveryCompleted: boolean;
};

export function ProfileSecurityView({
  twoFactorEnabled,
  recoveryCompleted,
}: ProfileSecurityViewProps) {
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
        <Badge tone={twoFactorEnabled ? "success" : "warning"}>
          {twoFactorEnabled ? "2FA enabled" : "2FA recommended"}
        </Badge>
      </header>
      <ProfileNavigation active="security" />
      <ProfileSecurity
        initialTwoFactorEnabled={twoFactorEnabled}
        recoveryCompleted={recoveryCompleted}
      />
    </div>
  );
}
