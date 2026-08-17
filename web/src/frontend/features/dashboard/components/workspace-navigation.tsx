"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceLocale } from "../client/workspace-locale";
import { WorkspaceNavIcon } from "./workspace-navigation-icons";

export function WorkspaceNavigation({
  busy,
  collapsed,
  onSignOut,
}: {
  busy: boolean;
  collapsed: boolean;
  onSignOut: () => void;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          dashboard: "Bảng điều khiển",
          jobs: "Việc làm",
          messages: "Tin nhắn",
          connections: "Kết nối",
          support: "Hỗ trợ",
          profile: "Hồ sơ",
          workspace: "Không gian ứng viên",
          openMenu: "Mở menu không gian làm việc",
          closeMenu: "Đóng menu không gian làm việc",
          signOut: "Đăng xuất",
          signingOut: "Đang đăng xuất…",
          savedJobs: "Việc đã lưu",
          appliedJobs: "Việc đã ứng tuyển",
          suggestedJobs: "Việc làm đề xuất",
          cvMatchCheck: "Kiểm tra độ phù hợp CV",
          recommendationSettings: "Cài đặt gợi ý việc làm",
        }
      : {
          dashboard: "Dashboard",
          jobs: "Jobs",
          messages: "Messages",
          connections: "Connections",
          support: "Support",
          profile: "Profile",
          workspace: "Candidate workspace",
          openMenu: "Open workspace menu",
          closeMenu: "Close workspace menu",
          signOut: "Sign out",
          signingOut: "Signing out…",
          savedJobs: "Saved Jobs",
          appliedJobs: "Applied Jobs",
          suggestedJobs: "Suggested Jobs",
          cvMatchCheck: "CV Match Check",
          recommendationSettings: "Job Recommendation Settings",
        };
  const destinations = [
    { href: "/dashboard", label: copy.dashboard, icon: "dashboard" },
    { href: "/jobs", label: copy.jobs, icon: "jobs" },
    { href: "/cv-match-check", label: copy.cvMatchCheck, icon: "cv-match" },
    { href: "/messages", label: copy.messages, icon: "messages" },
    { href: "/connections", label: copy.connections, icon: "connections" },
    { href: "/support", label: copy.support, icon: "support" },
    { href: "/profile", label: copy.profile, icon: "profile" },
  ] as const;
  const jobsSubnav = [
    { href: "/jobs/saved", label: copy.savedJobs },
    { href: "/jobs/applied", label: copy.appliedJobs },
    { href: "/jobs/matches", label: copy.suggestedJobs },
    { href: "/jobs/settings", label: copy.recommendationSettings },
  ] as const;
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: KeyboardEvent | PointerEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      const target = event.target;
      if (
        target instanceof Node &&
        !navigationRef.current?.contains(target) &&
        !toggleRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", closeMenu);
    document.addEventListener("pointerdown", closeMenu);
    return () => {
      document.removeEventListener("keydown", closeMenu);
      document.removeEventListener("pointerdown", closeMenu);
    };
  }, [menuOpen]);

  return (
    <>
      <button
        ref={toggleRef}
        className="workspace-menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="workspace-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg
          className="menu-toggle-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
        >
          <path
            d={menuOpen ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
          />
        </svg>
        {menuOpen ? copy.closeMenu : copy.openMenu}
      </button>
      <nav
        ref={navigationRef}
        id="workspace-navigation"
        className="workspace-navigation"
        aria-label={copy.workspace}
        data-open={menuOpen}
      >
        <span className="workspace-sidebar-width-sizer" aria-hidden="true">
          {[
            ...destinations.map((destination) => destination.label),
            ...jobsSubnav.map((subnav) => subnav.label),
            copy.signOut,
          ].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </span>
        <p className="workspace-nav-label">{copy.workspace}</p>
        <div className="workspace-navigation-scroll">
          {destinations.map((destination) => {
            const active =
              pathname === destination.href ||
              (destination.href !== "/dashboard" &&
                pathname.startsWith(destination.href));
            return (
              <div key={destination.href} className="workspace-navigation-item">
                <Link
                  href={destination.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={destination.label}
                  title={collapsed ? destination.label : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <WorkspaceNavIcon name={destination.icon} />
                  <span className="workspace-navigation-label">
                    {destination.label}
                  </span>
                </Link>
                {destination.href === "/jobs" && active ? (
                  <div className="workspace-navigation-subnav">
                    {jobsSubnav.map((subnav) => {
                      const subnavActive =
                        pathname === subnav.href ||
                        pathname.startsWith(`${subnav.href}/`);
                      return (
                        <Link
                          key={subnav.href}
                          href={subnav.href}
                          aria-current={subnavActive ? "page" : undefined}
                          title={collapsed ? subnav.label : undefined}
                          onClick={() => setMenuOpen(false)}
                        >
                          <span>{subnav.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="workspace-navigation-footer">
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            aria-busy={busy}
            aria-label={busy ? copy.signingOut : copy.signOut}
            title={
              collapsed ? (busy ? copy.signingOut : copy.signOut) : undefined
            }
          >
            <WorkspaceNavIcon name="signout" />
            <span className="workspace-navigation-label">
              {busy ? copy.signingOut : copy.signOut}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
