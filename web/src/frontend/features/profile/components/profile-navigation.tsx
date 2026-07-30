import Link from "next/link";

const destinations = [
  { href: "/profile", label: "Overview", key: "overview" },
  { href: "/profile/security", label: "Security", key: "security" },
  { href: "/profile/sessions", label: "Sessions", key: "sessions" },
] as const;

export function ProfileNavigation({
  active,
}: {
  active: (typeof destinations)[number]["key"];
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
