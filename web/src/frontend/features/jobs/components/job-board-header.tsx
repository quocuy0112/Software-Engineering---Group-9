import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";

export function JobBoardHeader({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="job-board-header">
      <div className="job-board-header-inner">
        <SmartHireBrand className="job-board-brand" />
        <nav className="job-board-navigation" aria-label="Job board">
          <Link href="/jobs">Browse jobs</Link>
          {authenticated ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/profile">Profile</Link>
            </>
          ) : (
            <>
              <Link href="/login?returnTo=%2Fjobs">Sign in</Link>
              <Link className="job-board-navigation-primary" href="/register">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
