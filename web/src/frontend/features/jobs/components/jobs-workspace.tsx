"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const labels =
    locale === "vi"
      ? {
          previousTabs: "Xem các mục phía trước",
          nextTabs: "Xem các mục tiếp theo",
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
          previousTabs: "Show previous tabs",
          nextTabs: "Show next tabs",
        };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const updateScrollControls = () => {
      const maximumScrollLeft =
        scrollElement.scrollWidth - scrollElement.clientWidth;
      setCanScrollLeft(scrollElement.scrollLeft > 1);
      setCanScrollRight(scrollElement.scrollLeft < maximumScrollLeft - 1);
    };

    updateScrollControls();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollControls);
    observer?.observe(scrollElement);
    window.addEventListener("resize", updateScrollControls);
    scrollElement.addEventListener("scroll", updateScrollControls, {
      passive: true,
    });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollControls);
      scrollElement.removeEventListener("scroll", updateScrollControls);
    };
  }, [locale]);

  function scrollTabs(direction: -1 | 1) {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollBy({
      left: direction * Math.max(scrollElement.clientWidth * 0.7, 160),
      behavior: "smooth",
    });
  }
  return (
    <nav
      className="jobs-workspace-nav"
      aria-label={labels.navigation}
      data-can-scroll-left={canScrollLeft}
      data-can-scroll-right={canScrollRight}
    >
      <div ref={scrollRef} className="jobs-workspace-nav-scroll">
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
      <button
        className="jobs-workspace-nav-control jobs-workspace-nav-control--previous"
        type="button"
        aria-label={labels.previousTabs}
        disabled={!canScrollLeft}
        onClick={() => scrollTabs(-1)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>
      <button
        className="jobs-workspace-nav-control jobs-workspace-nav-control--next"
        type="button"
        aria-label={labels.nextTabs}
        disabled={!canScrollRight}
        onClick={() => scrollTabs(1)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m10 6 6 6-6 6" />
        </svg>
      </button>
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
