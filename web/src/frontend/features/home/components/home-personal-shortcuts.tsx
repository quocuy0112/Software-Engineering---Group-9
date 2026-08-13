import Link from "next/link";
import type { HomeCopy } from "../home-copy";
import type { HomeViewer } from "../home-page-model";

export function HomePersonalShortcuts({
  viewer,
  copy,
}: {
  viewer: Exclude<HomeViewer, { kind: "guest" }>;
  copy: HomeCopy;
}) {
  const candidate = [
    ["/dashboard", copy.account.dashboard],
    ["/jobs/applied", copy.account.applications],
    ["/jobs/saved", copy.account.savedJobs],
  ] as const;
  const employer = [["/dashboard", copy.account.dashboard]] as const;
  const items = viewer.kind === "employer" ? employer : candidate;
  return (
    <nav className="home-shortcuts" aria-label={copy.account.shortcutsLabel}>
      {items.map(([href, label]) => (
        <Link href={href} key={href}>{label}</Link>
      ))}
    </nav>
  );
}
