import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/server/auth/require-session";

export default async function HomePageContent() {
  const current = await requireSession(await headers());

  return (
    <main className="home-page">
      <nav className="home-actions" aria-label="Home actions">
        {current ? (
          <Link className="home-action home-action--primary" href="/profile">
            Profile
          </Link>
        ) : (
          <>
            <Link className="home-action home-action--primary" href="/register">
              Sign up
            </Link>
            <Link className="home-action home-action--secondary" href="/login">
              Sign in
            </Link>
          </>
        )}
      </nav>
    </main>
  );
}
