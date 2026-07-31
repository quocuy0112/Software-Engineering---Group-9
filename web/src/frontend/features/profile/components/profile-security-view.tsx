import { ProfileNavigation } from "./profile-navigation";
import { ProfileSecurity } from "./profile-security";

type ProfileSecurityViewProps = {
  twoFactorEnabled: boolean;
  recoveryCompleted: boolean;
  csrfProof: string;
};

export function ProfileSecurityView({
  twoFactorEnabled,
  recoveryCompleted,
  csrfProof,
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
        <span className="page-heading-badge page-heading-badge--secure">
          {twoFactorEnabled ? "2FA enabled" : "2FA not enabled"}
        </span>
      </header>
      <ProfileNavigation active="security" />
      <ProfileSecurity
        initialTwoFactorEnabled={twoFactorEnabled}
        recoveryCompleted={recoveryCompleted}
        csrfProof={csrfProof}
      />
    </div>
  );
}
