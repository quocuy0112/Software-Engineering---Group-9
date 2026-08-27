"use client";

import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
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
  const vi = useWorkspaceLocale() === "vi";
  return (
    <header className="job-board-header">
      <div className="job-board-header-inner">
        <SmartHireBrand className="job-board-brand" />
        <GlobalImageSearch taxonomy={taxonomy} />

        <div className="job-board-header-actions">
          <nav
            className="job-board-navigation"
            aria-label={vi ? "Bảng việc làm" : "Job board"}
          >
            {authenticated ? (
              <>
                <Link href="/dashboard">
                  {vi ? "Bảng điều khiển" : "Dashboard"}
                </Link>
                <Link href="/profile">{vi ? "Hồ sơ" : "Profile"}</Link>
              </>
            ) : (
              <>
                <Link href="/login?returnTo=%2Fjobs">
                  {vi ? "Đăng nhập" : "Sign in"}
                </Link>
                <Link className="job-board-navigation-primary" href="/register">
                  {vi ? "Tạo tài khoản" : "Create account"}
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
