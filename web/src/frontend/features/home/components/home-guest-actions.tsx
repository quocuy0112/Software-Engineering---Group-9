import Link from "next/link";
export function HomeGuestActions({
  login,
  signup,
}: {
  login: string;
  signup: string;
}) {
  return (
    <div className="home-guest-actions">
      <Link href="/login?returnTo=%2F">{login}</Link>
      <Link className="home-button home-button--small" href="/register">
        {signup}
      </Link>
    </div>
  );
}
