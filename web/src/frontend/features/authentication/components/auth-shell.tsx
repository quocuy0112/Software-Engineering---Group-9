import { AuthMotion } from "./auth-motion";
import AuthFooter from "./AuthFooter";
import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";

type AuthShellProps = {
  children: React.ReactNode;
  locale?: "vi" | "en";
};

export function AuthShell({ children, locale = "en" }: AuthShellProps) {
  const copy =
    locale === "vi"
      ? {
          protection: "Bảo vệ tài khoản",
          secure: "An toàn",
          note: "Ví dụ minh hoạ — không phải trạng thái tài khoản của bạn.",
          emailVerified: "Xác thực email",
          twoFactor: "Bảo vệ tài khoản bằng 2FA",
          profile: "Xây dựng hồ sơ chuyên môn",
        }
      : {
          protection: "Account protection",
          secure: "Secure",
          note: "Illustration only — not your account status.",
          emailVerified: "Verify your email",
          twoFactor: "Protect your account with 2FA",
          profile: "Build your professional profile",
        };

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

          <div className="auth-visual-board">
            <div className="visual-board-header">
              <span className="visual-board-dot" />
              <span>{copy.protection}</span>
              <span className="visual-board-status">{copy.secure}</span>
            </div>
            <p className="visual-board-note">{copy.note}</p>
            <ol className="visual-trust-steps">
              <li className="is-complete">
                <span aria-hidden="true">✓</span> {copy.emailVerified}
              </li>
              <li className="is-complete">
                <span aria-hidden="true">✓</span> {copy.twoFactor}
              </li>
              <li>
                <span aria-hidden="true">3</span> {copy.profile}
              </li>
            </ol>
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
