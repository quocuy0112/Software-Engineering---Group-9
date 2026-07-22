"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const destinations = [
  { href: "/", label: "Dashboard" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/sessions", label: "Sessions" },
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

  return (
    <>
      <button
        className="workspace-menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="workspace-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
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
            destination.href === "/"
              ? pathname === "/"
              : pathname.startsWith(destination.href);
          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
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
