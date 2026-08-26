"use client";

import { TopBar } from "@/frontend/components/layout/top-bar";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export type ProfileNavigationDestination = {
  href: string;
  label: string;
  key: string;
};

export const foundationProfileDestinations = [
  { href: "/profile", label: "Professional", key: "overview" },
  { href: "/profile/cv-imports", label: "CV imports", key: "cv-imports" },
  { href: "/profile/account", label: "Account", key: "account" },
  { href: "/profile/preferences", label: "Preferences", key: "preferences" },
  { href: "/profile/security", label: "Security", key: "security" },
  { href: "/profile/sessions", label: "Sessions", key: "sessions" },
  { href: "/profile/about", label: "About me", key: "about" },
] as const satisfies readonly ProfileNavigationDestination[];

export function ProfileNavigation({
  active,
  destinations = foundationProfileDestinations,
}: {
  active: string;
  // Retained only so existing callers do not break; the navigation no longer
  // repeats a separate account avatar next to the workspace shell identity.
  accountName?: string;
  destinations?: readonly ProfileNavigationDestination[];
}) {
  const locale = useWorkspaceLocale();
  const brand = locale === "vi" ? "Hồ sơ và tài khoản" : "Profile and account";
  const labels: Record<string, string> | null =
    locale === "vi"
      ? {
          overview: "Hồ sơ chuyên môn",
          "cv-imports": "Nhập CV",
          account: "Tài khoản",
          preferences: "Tùy chọn",
          security: "Bảo mật",
          sessions: "Phiên đăng nhập",
          about: "Về bạn",
        }
      : null;

  return (
    <TopBar
      className="profile-navigation"
      ariaLabel={locale === "vi" ? "Hồ sơ" : "Profile"}
      brand={
        <span className="profile-navigation__brand">
          <span className="profile-navigation__brand-dot" aria-hidden="true" />
          {brand}
        </span>
      }
      tabs={destinations.map((destination) => ({
        href: destination.href,
        label: labels?.[destination.key] ?? destination.label,
        active: destination.key === active,
      }))}
    />
  );
}
