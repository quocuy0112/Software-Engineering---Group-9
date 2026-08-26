import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";
import { GlobalImageSearch } from "@/frontend/features/jobs/image-search/components/global-image-search";
import type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";

export function JobBoardHeader({
  authenticated,
  taxonomy,
}: {
  authenticated: boolean;
  taxonomy?: JobSearchTaxonomy;
}) {
  return (
    <header className="job-board-header">
      <div className="job-board-header-inner">
        <SmartHireBrand className="job-board-brand" />
        <GlobalImageSearch taxonomy={taxonomy} />

        <div className="job-board-header-actions">
          <nav className="job-board-navigation" aria-label="Job board">
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
