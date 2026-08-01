"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const destinations = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/profile", label: "Profile", icon: "profile" },
] as const;

export function WorkspaceNavigation({
  busy,
  collapsed,
  onSignOut,
}: {
  busy: boolean;
  collapsed: boolean;
  onSignOut: () => void;
}) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
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
        {menuOpen ? "Close workspace menu" : "Open workspace menu"}
      </button>
      <nav
        id="workspace-navigation"
        className="workspace-navigation"
        aria-label="Workspace"
        data-open={menuOpen}
      >
        <p className="workspace-nav-label">Workspace</p>
        <div className="workspace-navigation-scroll">
          {destinations.map((destination) => {
            const active =
              pathname === destination.href ||
              (destination.href !== "/dashboard" &&
                pathname.startsWith(destination.href));
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
            aria-label={busy ? "Signing out" : "Sign out"}
            title={collapsed ? (busy ? "Signing out" : "Sign out") : undefined}
          >
            <NavIcon name="signout" />
            <span className="workspace-navigation-label">
              {busy ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
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
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="nav-icon">
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <rect x="12" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="12" width="5" height="5" rx="1" />
      <rect x="12" y="12" width="5" height="5" rx="1" />
    </svg>
  );
}
