import Link from "next/link";
import type { ReactNode } from "react";

export type TopBarTab = {
  href: string;
  label: string;
  active?: boolean;
};

export function TopBar({
  tabs,
  brand,
  avatar,
  ariaLabel = "Workspace navigation",
  className = "",
}: {
  tabs: readonly TopBarTab[];
  brand?: ReactNode;
  avatar?: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <nav
      className={["sh-topbar", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      {brand ? <div className="sh-topbar__brand">{brand}</div> : null}
      <div className="sh-topbar__tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            className="sh-topbar__tab"
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {avatar ? <div className="sh-topbar__avatar">{avatar}</div> : null}
    </nav>
  );
}
