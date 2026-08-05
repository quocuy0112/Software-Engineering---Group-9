import { AuthMotion } from "./auth-motion";
import AuthFooter from "./AuthFooter";
import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <aside className="auth-visual" aria-label="About SmartHire">
        <div className="auth-visual-inner">
          <SmartHireBrand />

          <div className="auth-visual-copy">
            <p className="auth-eyebrow">YOUR STORY. YOUR NEXT MOVE.</p>
            <h2>Opportunity starts with a story worth seeing.</h2>
            <p>
              Shape a professional identity that feels true to you, while
              SmartHire keeps every important account action protected.
            </p>
          </div>

          <div className="auth-visual-board" aria-hidden="true">
            <div className="visual-board-header">
              <span className="visual-board-dot" />
              <span>Account protection</span>
              <span className="visual-board-status">Secure</span>
            </div>
            <div className="visual-profile-row">
              <span className="visual-avatar">AM</span>
              <span>
                <strong>Your identity stays yours</strong>
                <small>Private, transparent, and secure</small>
              </span>
            </div>
            <div className="visual-signal-row">
              <span className="visual-signal" />
              <span className="visual-signal" />
              <span className="visual-signal" />
              <span className="visual-signal-label">Protected by design</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-panel-tools">
            <ThemeToggle />
          </div>
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
