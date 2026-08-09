import Link from "next/link";
import { HomeAuthenticatedActions } from "./home-authenticated-actions";
import {
  SmartHireBrand,
  SmartHireMark,
} from "@/frontend/components/ui/smarthire-brand";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";
import { GlobalImageSearch } from "@/frontend/features/jobs/image-search/components/global-image-search";

type HomePageViewProps = {
  context: {
    profile: { name: string; email: string; image: string | null };
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
        <div className="home-visitor-topbar">
          <SmartHireBrand className="home-brand" />
          <GlobalImageSearch />
          <ThemeToggle compact />
        </div>
        <div className="home-visitor-copy">
          <p className="home-eyebrow">BUILD YOUR NEXT CHAPTER</p>
          <h1 id="home-title">
            Your talent deserves
            <span>the right opportunity.</span>
          </h1>
          <p>
            SmartHire brings your professional story, secure profile, and next
            career move into one thoughtful workspace.
          </p>
          <nav className="home-actions" aria-label="Home actions">
            <Link className="home-action home-action--primary" href="/jobs">
              Browse jobs
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="home-action home-action--secondary"
              href="/login?returnTo=%2Fjobs"
            >
              Sign in
            </Link>
            <Link
              className="home-action home-action--secondary"
              href="/register"
            >
              Create account
            </Link>
          </nav>
          <ul className="home-assurance-list" aria-label="SmartHire values">
            <li>
              <span aria-hidden="true">✓</span> Your story, your control
            </li>
            <li>
              <span aria-hidden="true">✓</span> Privacy-first by design
            </li>
            <li>
              <span aria-hidden="true">✓</span> Clearer paths forward
            </li>
          </ul>
        </div>

        <div className="home-product-preview" aria-hidden="true">
          <div className="home-preview-topbar">
            <SmartHireMark className="home-preview-mark" />
            <span>Candidate workspace</span>
            <i />
          </div>
          <div className="home-preview-body">
            <div className="home-preview-heading">
              <span>ONE PROFILE. MORE POSSIBILITIES.</span>
              <strong>Stand out for what you can do.</strong>
            </div>
            <div className="home-preview-progress">
              <span>
                <i />
                <b>Professional profile</b>
                <small>Thoughtfully organized</small>
              </span>
              <em>Ready</em>
            </div>
            <div className="home-preview-grid">
              <span>
                <i>01</i>
                <b>Identity</b>
                <small>Verified access</small>
              </span>
              <span>
                <i>02</i>
                <b>Security</b>
                <small>Protected controls</small>
              </span>
            </div>
            <div className="home-preview-footer">
              <span />
              Your workspace is protected
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
