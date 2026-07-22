import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <p className="workspace-kicker">SmartHire workspace</p>
      <h1 id="workspace-page-title">Dashboard</h1>
      <p>
        Your identity workspace is ready. Use the links below to manage
        account security and active sessions.
      </p>
      <div className="dashboard-links" aria-label="Dashboard shortcuts">
        <Link href="/settings/security">
          <strong>Security</strong>
          <span>Manage two-factor authentication and backup codes.</span>
        </Link>
        <Link href="/settings/sessions">
          <strong>Sessions</strong>
          <span>Review and revoke signed-in devices.</span>
        </Link>
      </div>
      <section className="dashboard-coming-later" aria-labelledby="future-workspace-title">
        <h2 id="future-workspace-title">Workspace areas coming later</h2>
        <p>
          Candidate and Recruiter workflows are not available in this
          foundation increment.
        </p>
      </section>
    </div>
  );
}
