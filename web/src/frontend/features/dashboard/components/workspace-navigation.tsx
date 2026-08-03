"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceLocale } from "../client/workspace-locale";

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
        dashboard: "Tổng quan",
          jobs: "Việc làm",
          cvImports: "Nhập CV",
          profile: "Hồ sơ",
          workspace: "Không gian làm việc",
          openMenu: "Mở menu làm việc",
          closeMenu: "Đóng menu làm việc",
          signOut: "Đăng xuất",
          signingOut: "Đang đăng xuất…",
        }
      : {
          dashboard: "Dashboard",
          jobs: "Jobs",
          cvImports: "CV imports",
          profile: "Profile",
          workspace: "Workspace",
          openMenu: "Open workspace menu",
          closeMenu: "Close workspace menu",
          signOut: "Sign out",
          signingOut: "Signing out…",
        };
  const destinations = [
    { href: "/dashboard", label: copy.dashboard, icon: "dashboard" },
    { href: "/jobs", label: copy.jobs, icon: "jobs" },
    { href: "/profile/cv-imports", label: copy.cvImports, icon: "cv" },
    { href: "/profile", label: copy.profile, icon: "profile" },
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
        aria-label={locale === "vi" ? "Không gian làm việc" : "Workspace"}
        data-open={menuOpen}
      >
        <p className="workspace-nav-label">{copy.workspace}</p>
        <div className="workspace-navigation-scroll">
          {destinations.map((destination) => {
            const active = isDestinationActive(pathname, destination.href);
            return (
              <Link
                key={destination.href}
                href={destination.href}
                aria-current={active ? "page" : undefined}
                aria-label={destination.label}
                title={collapsed ? destination.label : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <NavIcon name={destination.icon} />
                <span className="workspace-navigation-label">
                  {destination.label}
                </span>
              </Link>
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
            <NavIcon name="signout" />
            <span className="workspace-navigation-label">
              {busy ? copy.signingOut : copy.signOut}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function isDestinationActive(pathname: string, href: string) {
  if (href === "/profile") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith("/profile/cv-imports"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ name }: { name: string }) {
  if (name === "signout") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8" />
        <path d="M11 6.5 14.5 10 11 13.5M7 10h7.5" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <circle cx="10" cy="6.5" r="3" />
        <path d="M4 17c.7-3.2 2.7-4.8 6-4.8s5.3 1.6 6 4.8" />
      </svg>
    );
  }
  if (name === "jobs") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <rect x="3" y="6" width="14" height="10" rx="2" />
        <path d="M7 6V4.8C7 3.8 7.8 3 8.8 3h2.4c1 0 1.8.8 1.8 1.8V6M3 10h14M8 10v1h4v-1" />
      </svg>
    );
  }
  if (name === "cv") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
        <path d="M6 2.5h6l3 3V17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
        <path d="M12 2.5V6h3M7.5 9h5M7.5 12h5M7.5 15h3" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <rect x="12" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="12" width="5" height="5" rx="1" />
      <rect x="12" y="12" width="5" height="5" rx="1" />
    </svg>
  );
}
