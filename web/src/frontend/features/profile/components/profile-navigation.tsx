import Link from "next/link";

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
  return (
    <nav className="profile-navigation" aria-label="Profile">
      {destinations.map((destination) => (
        <Link
          key={destination.href}
          href={destination.href}
          aria-current={destination.key === active ? "page" : undefined}
        >
          {destination.label}
        </Link>
      ))}
    </nav>
  );
}
