import { AuthMotion } from "./auth-motion";
export function AuthShell({ children }: { children: React.ReactNode }) { return <main className="auth-page"><section className="auth-card" aria-labelledby="page-title"><AuthMotion>{children}</AuthMotion></section></main>; }
