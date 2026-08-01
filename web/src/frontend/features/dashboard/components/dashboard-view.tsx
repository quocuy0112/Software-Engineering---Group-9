import Link from "next/link";
import { Badge } from "@/frontend/components/ui/badge";
import { SmartHireMark } from "@/frontend/components/ui/smarthire-brand";

export function DashboardView() {
  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div>
          <p className="workspace-kicker">YOUR SMART WORKSPACE</p>
          <h1 id="workspace-page-title">Dashboard</h1>
          <p className="page-heading-copy">
            A clear starting point for your SmartHire journey.
          </p>
        </div>
        <Badge className="page-heading-badge" tone="info">
          Candidate view
        </Badge>
      </header>

      <section
        className="dashboard-hero"
        aria-labelledby="dashboard-welcome-title"
      >
        <div className="dashboard-hero-copy">
          <p className="dashboard-hero-eyebrow">WELCOME TO SMARTHIRE</p>
          <h2 id="dashboard-welcome-title">
            Your next chapter starts with a strong foundation.
          </h2>
          <p>
            Your secure identity workspace is ready. Keep your access protected
            now, then build your professional presence as new areas arrive.
          </p>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <span className="hero-orbit hero-orbit--one" />
          <span className="hero-orbit hero-orbit--two" />
          <SmartHireMark className="hero-person" />
          <span className="hero-spark hero-spark--one">
            <DashboardIcon name="spark" />
          </span>
          <span className="hero-spark hero-spark--two">
            <DashboardIcon name="spark" />
          </span>
        </div>
      </section>

      <section
        className="dashboard-feature-grid"
        aria-label="SmartHire workspace preview"
      >
        <article className="feature-card">
          <span className="feature-card-index">01</span>
          <div className="feature-icon" aria-hidden="true">
            <DashboardIcon name="profile" />
          </div>
          <h2>Candidate profile</h2>
          <p>
            Shape a clear professional story that is ready to be discovered.
          </p>
          <Badge className="feature-status">Coming soon</Badge>
        </article>
        <article className="feature-card">
          <span className="feature-card-index">02</span>
          <div className="feature-icon" aria-hidden="true">
            <DashboardIcon name="spark" />
          </div>
          <h2>Smart matching</h2>
          <p>Connect your strengths with meaningful career opportunities.</p>
          <Badge className="feature-status">Coming soon</Badge>
        </article>
        <article className="feature-card">
          <span className="feature-card-index">03</span>
          <div className="feature-icon" aria-hidden="true">
            <DashboardIcon name="team" />
          </div>
          <h2>Hiring team tools</h2>
          <p>
            Create a focused, human experience for every talent conversation.
          </p>
          <Badge className="feature-status">Coming soon</Badge>
        </article>
      </section>

      <div className="dashboard-lower-grid">
        <section
          className="dashboard-panel"
          aria-labelledby="account-foundation-title"
        >
          <div className="dashboard-panel-header">
            <div>
              <p className="panel-kicker">ACCOUNT FOUNDATION</p>
              <h2 id="account-foundation-title">Ready for what comes next</h2>
            </div>
            <span className="panel-status-dot" aria-hidden="true" />
          </div>
          <ul className="account-checklist">
            <li>
              <span className="checklist-icon" aria-hidden="true">
                <DashboardIcon name="check" />
              </span>
              <span>
                <strong>Secure account access</strong>
                <small>
                  Your verified identity is the start of every journey.
                </small>
              </span>
            </li>
            <li>
              <span
                className="checklist-icon checklist-icon--soft"
                aria-hidden="true"
              >
                <DashboardIcon name="plus" />
              </span>
              <span>
                <strong>Add another layer</strong>
                <small>
                  Enable two-factor authentication for stronger protection.
                </small>
              </span>
            </li>
          </ul>
        </section>

        <section
          className="dashboard-panel"
          aria-labelledby="quick-access-title"
        >
          <div className="dashboard-panel-header">
            <div>
              <p className="panel-kicker">QUICK ACCESS</p>
              <h2 id="quick-access-title">Manage your account</h2>
            </div>
          </div>
          <div className="dashboard-links" aria-label="Dashboard shortcuts">
            <Link href="/profile">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="profile" />
              </span>
              <span>
                <strong>Profile</strong>
                <small>Review your account overview</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
            <Link href="/profile/security">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="shield" />
              </span>
              <span>
                <strong>Security</strong>
                <small>Two-factor authentication and backup codes</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
            <Link href="/profile/sessions">
              <span className="shortcut-icon" aria-hidden="true">
                <DashboardIcon name="device" />
              </span>
              <span>
                <strong>Sessions</strong>
                <small>Review and revoke signed-in devices</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                <DashboardIcon name="arrow" />
              </span>
            </Link>
          </div>
        </section>
      </div>

      <section
        className="dashboard-coming-later"
        aria-labelledby="future-workspace-title"
      >
        <SmartHireMark className="coming-later-mark" />
        <div>
          <p className="panel-kicker">PRODUCT ROADMAP</p>
          <h2 id="future-workspace-title">More workspace areas coming later</h2>
          <p>
            Candidate and Recruiter workflows will be introduced in a future
            SmartHire increment.
          </p>
        </div>
        <Badge className="coming-later-pill" tone="info">
          Foundation ready
        </Badge>
      </section>
    </div>
  );
}

function DashboardIcon({
  name,
}: {
  name:
    | "arrow"
    | "check"
    | "device"
    | "plus"
    | "profile"
    | "shield"
    | "spark"
    | "team";
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    device: (
      <>
        <rect x="4" y="5" width="16" height="12" rx="2" />
        <path d="M9 20h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
      </>
    ),
    shield: (
      <path d="M12 3 5.5 5.5v5.2c0 4.1 2.3 7.6 6.5 9.3 4.2-1.7 6.5-5.2 6.5-9.3V5.5L12 3Zm-3 9 2 2 4-5" />
    ),
    spark: (
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2" />
        <path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M14.5 15c2.8-.4 4.8 1.2 5.5 4" />
      </>
    ),
  };

  return (
    <svg className="dashboard-icon" viewBox="0 0 24 24" focusable="false">
      {paths[name]}
    </svg>
  );
}
