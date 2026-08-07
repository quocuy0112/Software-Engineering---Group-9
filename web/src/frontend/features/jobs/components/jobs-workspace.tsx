import Link from "next/link";

export const jobsWorkspaceTabs = [
  { id: "search", href: "/jobs", label: "Find jobs" },
  { id: "saved", href: "/jobs/saved", label: "Saved Jobs" },
  { id: "applied", href: "/jobs/applied", label: "Applied Jobs" },
  { id: "matches", href: "/jobs/matches", label: "Suggested Jobs" },
  {
    id: "settings",
    href: "/jobs/settings",
    label: "Job Recommendation Settings",
  },
] as const;

export type JobsWorkspaceTab = (typeof jobsWorkspaceTabs)[number]["id"];

export function JobsWorkspaceNav({
  activeTab,
}: {
  activeTab: JobsWorkspaceTab;
}) {
  return (
    <nav className="jobs-workspace-nav" aria-label="Jobs workspace">
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
