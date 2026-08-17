"use client";

import { TopBar } from "@/frontend/components/layout/top-bar";
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
          navigation: "Không gian ứng viên",
        }
      : {
          search: "Find jobs",
          saved: "Saved Jobs",
          applied: "Applied Jobs",
          matches: "Suggested Jobs",
          settings: "Job Recommendation Settings",
          navigation: "Candidate workspace",
        };

  return (
    <TopBar
      className="jobs-workspace-nav"
      ariaLabel={labels.navigation}
      tabs={jobsWorkspaceTabs.map((tab) => ({
        href: tab.href,
        label: labels[tab.id],
        active: activeTab === tab.id,
      }))}
    />
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
