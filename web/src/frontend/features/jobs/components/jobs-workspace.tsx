"use client";

import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export const jobsWorkspaceTabs = [
  { id: "search", href: "/jobs" },
  { id: "saved", href: "/jobs/saved" },
  { id: "applied", href: "/jobs/applied" },
  { id: "matches", href: "/jobs/matches" },
  { id: "settings", href: "/jobs/settings" },
] as const;

export type JobsWorkspaceTab = (typeof jobsWorkspaceTabs)[number]["id"];

export function JobsWorkspaceNav({
  activeTab,
}: {
  activeTab: JobsWorkspaceTab;
}) {
  const locale = useWorkspaceLocale();
  const labels =
    locale === "vi"
      ? {
          search: "Tìm việc",
          saved: "Việc đã lưu",
          applied: "Việc đã ứng tuyển",
          matches: "Việc làm đề xuất",
          settings: "Cài đặt gợi ý việc làm",
          navigation: "Không gian việc làm",
        }
      : {
          search: "Find jobs",
          saved: "Saved Jobs",
          applied: "Applied Jobs",
          matches: "Suggested Jobs",
          settings: "Job Recommendation Settings",
          navigation: "Jobs workspace",
        };
  return (
    <nav className="jobs-workspace-nav" aria-label={labels.navigation}>
      <div className="jobs-workspace-nav-scroll">
        {jobsWorkspaceTabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {labels[tab.id]}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function JobsWorkspace({
  activeTab,
  children,
}: {
  activeTab: Exclude<JobsWorkspaceTab, "search">;
  children: React.ReactNode;
}) {
  return (
    <div className="jobs-workspace-page">
      <JobsWorkspaceNav activeTab={activeTab} />
      {children}
    </div>
  );
}
