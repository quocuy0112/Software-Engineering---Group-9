import Image from "next/image";
import Link from "next/link";
import { HomeLogoutAction } from "./home-logout-action";

export function HomeAccountMenu({
  name,
  avatarUrl,
  csrfProof,
  labels,
}: {
  name: string;
  avatarUrl: string | null;
  csrfProof: string;
  labels: {
    profile: string;
    fallbackName: string;
    logout: string;
    loggingOut: string;
    logoutSuccess: string;
    logoutError: string;
  };
}) {
  const avatar = /^data:image\/(?:png|jpeg|webp);base64,/u.test(
    avatarUrl ?? "",
  )
    ? avatarUrl
    : null;
  return (
    <div className="home-account-menu">
      <Link href="/profile" className="home-account-link" aria-label={labels.profile}>
        <span className="home-avatar" aria-hidden="true">
          {avatar ? (
            <Image src={avatar} alt="" width={34} height={34} unoptimized />
          ) : (
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 19c.7-3.1 3-4.8 6.5-4.8s5.8 1.7 6.5 4.8" />
            </svg>
          )}
        </span>
        <span className="home-account-name">{name.trim() || labels.fallbackName}</span>
      </Link>
      <HomeLogoutAction csrfProof={csrfProof} labels={labels} />
    </div>
  );
}
