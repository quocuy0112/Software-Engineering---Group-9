import { AuthMotion } from "./auth-motion";
import Link from "next/link";
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <header className="auth-header">
          <Link className="smart-hire-brand" href="/">
            SmartHire
          </Link>
          <p>Secure identity workspace</p>
        </header>
        <nav className="auth-navigation" aria-label="Authentication">
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create account</Link>
          <Link href="/forgot-password">Forgot password</Link>
        </nav>
        <AuthMotion>{children}</AuthMotion>
        <footer className="auth-footer">
          <Link href="/login">Return to sign in</Link>
        </footer>
      </section>
    </main>
  );
}
