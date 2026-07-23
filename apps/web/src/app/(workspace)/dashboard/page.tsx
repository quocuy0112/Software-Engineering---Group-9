import Link from "next/link";

export default function DashboardPage() {
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
        <span className="page-heading-badge">Candidate view</span>
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
          <span className="hero-person">SH</span>
          <span className="hero-spark hero-spark--one">✦</span>
          <span className="hero-spark hero-spark--two">✦</span>
        </div>
      </section>

      <section
        className="dashboard-feature-grid"
        aria-label="SmartHire workspace preview"
      >
        <article className="feature-card feature-card--lavender">
          <span className="feature-card-index">01</span>
          <div className="feature-icon" aria-hidden="true">
            ◒
          </div>
          <h2>Candidate profile</h2>
          <p>
            Shape a clear professional story that is ready to be discovered.
          </p>
          <span className="feature-status">Coming soon</span>
        </article>
        <article className="feature-card feature-card--mint">
          <span className="feature-card-index">02</span>
          <div className="feature-icon" aria-hidden="true">
            ✦
          </div>
          <h2>Smart matching</h2>
          <p>Connect your strengths with meaningful career opportunities.</p>
          <span className="feature-status">Coming soon</span>
        </article>
        <article className="feature-card feature-card--sand">
          <span className="feature-card-index">03</span>
          <div className="feature-icon" aria-hidden="true">
            ◎
          </div>
          <h2>Hiring team tools</h2>
          <p>
            Create a focused, human experience for every talent conversation.
          </p>
          <span className="feature-status">Coming soon</span>
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
                ✓
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
                +
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
                â—‹
              </span>
              <span>
                <strong>Profile</strong>
                <small>Review your account overview</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                â†’
              </span>
            </Link>
            <Link href="/profile/security">
              <span className="shortcut-icon" aria-hidden="true">
                ◇
              </span>
              <span>
                <strong>Security</strong>
                <small>Two-factor authentication and backup codes</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/profile/sessions">
              <span
                className="shortcut-icon shortcut-icon--mint"
                aria-hidden="true"
              >
                □
              </span>
              <span>
                <strong>Sessions</strong>
                <small>Review and revoke signed-in devices</small>
              </span>
              <span className="shortcut-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      </div>

      <section
        className="dashboard-coming-later"
        aria-labelledby="future-workspace-title"
      >
        <span className="coming-later-mark" aria-hidden="true">
          S
        </span>
        <div>
          <p className="panel-kicker">PRODUCT ROADMAP</p>
          <h2 id="future-workspace-title">More workspace areas coming later</h2>
          <p>
            Candidate and Recruiter workflows will be introduced in a future
            SmartHire increment.
          </p>
        </div>
        <span className="coming-later-pill">Foundation ready</span>
      </section>
    </div>
  );
}
