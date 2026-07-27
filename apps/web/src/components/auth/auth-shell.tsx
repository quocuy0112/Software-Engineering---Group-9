import { AuthMotion } from "./auth-motion";
import AuthFooter from "./AuthFooter";
import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <aside className="auth-visual" aria-label="About SmartHire">
        <div className="auth-visual-inner">
          <Link className="smart-hire-brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            <span>SmartHire</span>
          </Link>

          <div className="auth-visual-copy">
            <p className="auth-eyebrow">THE TALENT CONNECTION</p>
            <h2>
              Make your next
              <br />
              <em>great move.</em>
            </h2>
            <p>
              One calm, secure place to shape your career story and stay ready
              for what comes next.
            </p>
          </div>

          <div className="auth-visual-board" aria-hidden="true">
            <div className="visual-board-header">
              <span className="visual-board-dot" />
              <span>SmartHire profile</span>
              <span className="visual-board-status">Ready</span>
            </div>
            <div className="visual-profile-row">
              <span className="visual-avatar">AM</span>
              <span>
                <strong>Your professional story</strong>
                <small>Built for meaningful connections</small>
              </span>
            </div>
            <div className="visual-signal-row">
              <span className="visual-signal visual-signal--violet" />
              <span className="visual-signal visual-signal--mint" />
              <span className="visual-signal visual-signal--gold" />
              <span className="visual-signal-label">Secure by design</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <section className="auth-card">
            <nav className="auth-navigation" aria-label="Authentication">
              <Link href="/login">Sign in</Link>
              <Link href="/register">Create account</Link>
              <Link href="/forgot-password">Forgot password</Link>
            </nav>

            <AuthMotion>{children}</AuthMotion>

            <AuthFooter />
          </section>

          <p className="auth-panel-note">
            SmartHire keeps account access simple, transparent, and secure.
          </p>
        </div>
      </section>
    </main>
  );
}
