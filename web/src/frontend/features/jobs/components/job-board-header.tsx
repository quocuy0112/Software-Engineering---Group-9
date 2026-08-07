import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";

export function JobBoardHeader({ authenticated }: { authenticated: boolean }) {
  return (
    <header className="job-board-header">
      <div className="job-board-header-inner">
        <SmartHireBrand className="job-board-brand" />

        <div className="job-board-header-actions">
          <nav className="job-board-navigation" aria-label="Job board">
            <Link href="/jobs">Browse jobs</Link>
            <Link href="#global-image-search">Image search</Link>

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

          <ThemeToggle compact />
        </div>
      </div>
    </header>
  );
}
