"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlobalImageSearch } from "@/frontend/features/jobs/image-search/components/global-image-search";
import type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";

const searchableJobWorkspacePaths = new Set([
  "/jobs",
  "/jobs/saved",
  "/jobs/matches",
  "/jobs/settings",
]);

/**
 * The search control belongs to the Jobs layout, not an individual tab. This
 * keeps its component state alive while switching between job-list views.
 */
export function JobWorkspaceSearch({
  taxonomy,
}: Readonly<{
  taxonomy: JobSearchTaxonomy;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = useCallback(
    (href: string) => {
      // Find Jobs already owns a live result list, so notify that list without
      // remounting the persistent header. Other tabs render their scoped data
      // on navigation and therefore use the App Router normally.
      if (pathname === "/jobs") {
        window.history.pushState(null, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
        return;
      }
      router.push(href);
    },
    [pathname, router],
  );

  if (!searchableJobWorkspacePaths.has(pathname)) return null;

  return (
    <GlobalImageSearch
      taxonomy={taxonomy}
      dockToWorkspaceHeader
      onJobSearchNavigate={navigate}
    />
  );
}
