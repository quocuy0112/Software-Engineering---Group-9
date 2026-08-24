"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlobalImageSearch } from "@/frontend/features/jobs/image-search/components/global-image-search";
import type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";

/**
 * The enterprise omnibar belongs to Find Jobs only. Scoped pages reuse the
 * same workspace header without reserving a search track.
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

  if (pathname !== "/jobs") return null;

  return (
    <GlobalImageSearch
      taxonomy={taxonomy}
      dockToWorkspaceHeader
      onJobSearchNavigate={navigate}
    />
  );
}
