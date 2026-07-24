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
  onSignOut,
}: {
  busy: boolean;
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
        <span className="menu-toggle-icon" aria-hidden="true">
          {menuOpen ? "×" : "☰"}
        </span>
        {menuOpen ? "Close workspace menu" : "Open workspace menu"}
      </button>
      <nav
        id="workspace-navigation"
        className="workspace-navigation"
        aria-label="Workspace"
        data-open={menuOpen}
      >
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
              onClick={() => setMenuOpen(false)}
            >
              <NavIcon name={destination.icon} />
              {destination.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onSignOut}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </nav>
    </>
  );
}

function NavIcon({ name }: { name: string }) {
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
