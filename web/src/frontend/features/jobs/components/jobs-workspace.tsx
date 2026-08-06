import Link from "next/link";

export const jobsWorkspaceTabs = [
  { id: "search", href: "/jobs", label: "Tìm việc" },
  { id: "saved", href: "/jobs/saved", label: "Việc làm đã lưu" },
  { id: "applied", href: "/jobs/applied", label: "Việc làm đã ứng tuyển" },
  { id: "matches", href: "/jobs/matches", label: "Việc làm phù hợp" },
  {
    id: "settings",
    href: "/jobs/settings",
    label: "Cài đặt gợi ý việc làm",
  },
] as const;

export type JobsWorkspaceTab = (typeof jobsWorkspaceTabs)[number]["id"];

export function JobsWorkspaceNav({
  activeTab,
}: {
  activeTab: JobsWorkspaceTab;
}) {
  return (
    <nav className="jobs-workspace-nav" aria-label="Khu vực việc làm">
      <div className="jobs-workspace-nav-scroll">
        {jobsWorkspaceTabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
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
