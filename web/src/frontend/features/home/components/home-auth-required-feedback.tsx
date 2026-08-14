import Link from "next/link";
import { HomeSaveIcon } from "./home-save-icon";

export function safeHomeLoginHref(returnTo: string) {
  const safe = /^\/jobs\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(returnTo)
    ? returnTo
    : "/jobs";
  return `/login?returnTo=${encodeURIComponent(safe)}`;
}

export function HomeAuthRequiredFeedback({
  returnTo,
  label,
}: {
  returnTo: string;
  label: string;
}) {
  return (
    <Link
      className="home-save-link"
      href={safeHomeLoginHref(returnTo)}
      aria-label={label}
      data-tooltip={label}
    >
      <HomeSaveIcon />
    </Link>
  );
}
