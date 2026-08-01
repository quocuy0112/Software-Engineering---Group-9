import Link from "next/link";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export type ProfileNavigationDestination = {
  href: string;
  label: string;
  key: string;
};

export const foundationProfileDestinations = [
  { href: "/profile", label: "Professional", key: "overview" },
  { href: "/profile/account", label: "Account", key: "account" },
  { href: "/profile/preferences", label: "Preferences", key: "preferences" },
  { href: "/profile/security", label: "Security", key: "security" },
  { href: "/profile/sessions", label: "Sessions", key: "sessions" },
] as const satisfies readonly ProfileNavigationDestination[];

export function ProfileNavigation({
  active,
  destinations = foundationProfileDestinations,
}: {
  active: string;
  destinations?: readonly ProfileNavigationDestination[];
}) {
  const locale = useWorkspaceLocale();
  const labels =
    locale === "vi"
      ? {
          overview: "Nghề nghiệp",
          account: "Tài khoản",
          preferences: "Tùy chọn",
          security: "Bảo mật",
          sessions: "Phiên đăng nhập",
        }
      : null;
  return (
    <nav
      className="profile-navigation"
      aria-label={locale === "vi" ? "Hồ sơ" : "Profile"}
    >
      {destinations.map((destination) => (
        <Link
          key={destination.href}
          href={destination.href}
          aria-current={destination.key === active ? "page" : undefined}
        >
          {labels?.[destination.key as keyof typeof labels] ??
            destination.label}
        </Link>
      ))}
    </nav>
  );
}
