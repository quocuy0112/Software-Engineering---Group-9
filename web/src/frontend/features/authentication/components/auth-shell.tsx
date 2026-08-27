import { AuthMotion } from "./auth-motion";
import AuthFooter from "./AuthFooter";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { WorkspaceLocaleProvider } from "@/frontend/features/dashboard/client/workspace-locale";
import { authCopy } from "./auth-copy";

type AuthShellProps = {
  children: React.ReactNode;
  locale?: "vi" | "en";
};

export function AuthShell({ children, locale = "en" }: AuthShellProps) {
  const copy = authCopy(locale);

  return (
    <WorkspaceLocaleProvider initialLocale={locale}>
      <main className="auth-page">
        <aside className="auth-visual" aria-label={copy.shell.about}>
        <div className="auth-visual-inner">
          <SmartHireBrand />

          <div className="auth-visual-copy">
            <p className="auth-eyebrow">{copy.shell.eyebrow}</p>
            <h2>{copy.shell.title}</h2>
            <p>{copy.shell.description}</p>
          </div>

          <div className="auth-visual-board">
            <div className="visual-board-header">
              <span className="visual-board-dot" />
              <span>{copy.shell.protection}</span>
              <span className="visual-board-status">{copy.shell.secure}</span>
            </div>
            <p className="visual-board-note">{copy.shell.note}</p>
            <ol className="visual-trust-steps">
              <li className="is-complete">
                <span aria-hidden="true">✓</span> {copy.shell.emailVerified}
              </li>
              <li className="is-complete">
                <span aria-hidden="true">✓</span> {copy.shell.twoFactor}
              </li>
              <li>
                <span aria-hidden="true">3</span> {copy.shell.profile}
              </li>
            </ol>
          </div>
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <section className="auth-card">
            <nav className="auth-navigation" aria-label={copy.shell.navigation}>
              <Link href="/login">{copy.shell.signIn}</Link>
              <Link href="/register">{copy.shell.createAccount}</Link>
              <Link href="/forgot-password">{copy.shell.forgotPassword}</Link>
            </nav>

            <AuthMotion>{children}</AuthMotion>

            <AuthFooter />
          </section>

          <p className="auth-panel-note">
            <ShieldCheck size={15} aria-hidden="true" />
            {copy.shell.panelNote}
          </p>
        </div>
      </section>
      </main>
    </WorkspaceLocaleProvider>
  );
}
