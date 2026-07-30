import Link from "next/link";
import { HomeAuthenticatedActions } from "./home-authenticated-actions";

type HomePageViewProps = {
  context: {
    profile: { name: string; email: string };
    csrfProof: string;
  } | null;
};

export function HomePageView({ context }: HomePageViewProps) {
  if (context) {
    return (
      <main className="home-page">
        <HomeAuthenticatedActions
          profile={context.profile}
          csrfProof={context.csrfProof}
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
