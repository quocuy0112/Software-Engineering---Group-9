import Link from "next/link";
import { ProfileNavigation } from "./profile-navigation";

type ProfileOverviewProps = {
  account: {
    name: string;
    email: string;
    memberSince: string;
    twoFactorEnabled: boolean;
  };
};

export function ProfileOverview({ account }: ProfileOverviewProps) {
  return (
    <div className="profile-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">YOUR SMART HIRE ACCOUNT</p>
          <h1 id="workspace-page-title">Profile</h1>
          <p className="page-heading-copy">
            Manage your identity, sign-in protection, and active sessions in one
            place.
          </p>
        </div>
        <span className="page-heading-badge page-heading-badge--secure">
          {account.twoFactorEnabled ? "2FA enabled" : "2FA not enabled"}
        </span>
      </header>
      <ProfileNavigation active="overview" />

      <section className="profile-overview-grid" aria-label="Profile overview">
        <article className="profile-account-card profile-card">
          <p className="panel-kicker">ACCOUNT DETAILS</p>
          <h2>{account.name}</h2>
          <dl className="profile-account-details">
            <div>
              <dt>Email address</dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>Active</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{account.memberSince}</dd>
            </div>
          </dl>
          <div className="profile-account-actions">
            <span className="profile-status-pill">
              {account.twoFactorEnabled ? "2FA enabled" : "2FA recommended"}
            </span>
            <Link href="/profile/security">Review security</Link>
          </div>
        </article>

        <article className="profile-card profile-security-card">
          <p className="panel-kicker">SECURITY</p>
          <h2>Keep your account protected</h2>
          <p>
            Manage your password, authenticator, backup codes, and trusted
            sessions from one secure place.
          </p>
          <Link className="profile-card-link" href="/profile/security">
            Open security settings
          </Link>
        </article>
      </section>

      <section
        className="profile-future-section"
        aria-labelledby="profile-future-title"
      >
        <div className="profile-section-heading">
          <div>
            <p className="workspace-kicker">YOUR PROFESSIONAL STORY</p>
            <h2 id="profile-future-title">Build your profile over time</h2>
          </div>
          <p>These areas will be available in future SmartHire increments.</p>
        </div>
        <div className="profile-placeholder-grid">
          {["CV", "Education", "Certificates", "Skills", "Experience"].map(
            (label) => (
              <article className="profile-placeholder-card" key={label}>
                <span className="profile-placeholder-icon" aria-hidden="true">
                  +
                </span>
                <h3>{label}</h3>
                <p>Coming later</p>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
