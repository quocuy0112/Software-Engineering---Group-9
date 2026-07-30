import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/backend/auth/session/require-session";
import { prisma } from "@/backend/database/prisma";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import { HomeAuthenticatedActions } from "@/frontend/features/authentication/components/auth/home-authenticated-actions";

export default async function HomePageContent() {
  const current = await requireSession(await headers());
  const account = current
    ? await prisma.userAccount.findUnique({
        where: { id: current.userId },
        select: { name: true, email: true },
      })
    : null;

  if (current && account) {
    return (
      <main className="home-page">
        <HomeAuthenticatedActions
          profile={account}
          csrfProof={csrfProof(current.sessionId)}
        />
      </main>
    );
  }

  return (
    <main className="home-page">
      <section className="home-visitor" aria-labelledby="home-title">
        <Link className="smart-hire-brand home-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>SmartHire</span>
        </Link>
        <p className="home-eyebrow">THE TALENT CONNECTION</p>
        <h1 id="home-title">Make your next great move.</h1>
        <p>
          One calm, secure place to shape your career story and stay ready for
          what comes next.
        </p>
      <nav className="home-actions" aria-label="Home actions">
          <Link className="home-action home-action--primary" href="/login">
            Sign in
          </Link>
          <Link className="home-action home-action--secondary" href="/register">
            Create account
          </Link>
      </nav>
      </section>
    </main>
  );
}
