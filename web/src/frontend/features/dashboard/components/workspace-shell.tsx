"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { postWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { WorkspaceNavigation } from "./workspace-navigation";

export function WorkspaceShell({
  children,
  csrfProof,
  profile = { name: "SmartHire member", email: "" },
}: {
  children: React.ReactNode;
  csrfProof: string;
  profile?: { name: string; email: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [status, setStatus] = useState("");

  async function signOut() {
    if (busy || navigating) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await postWithCurrentCsrf(
        "/api/identity/logout",
        csrfProof,
      );
      if (!response.ok) {
        setStatus("Unable to sign out. Please try again.");
        return;
      }
      startNavigation(() => router.replace("/login"));
    } catch {
      setStatus("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace-page">
      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar-brand">
            <Link className="smart-hire-brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                S
              </span>
              <span>SmartHire</span>
            </Link>
            <span className="workspace-product-label">Talent workspace</span>
          </div>
          <WorkspaceNavigation
            busy={busy || navigating}
            onSignOut={() => void signOut()}
          />
          <div className="workspace-sidebar-footer"></div>
        </aside>
        <div className="workspace-main">
          <header className="workspace-header">
            <div>
              <p className="workspace-topbar-kicker">Candidate workspace</p>
              <p className="workspace-topbar-title">Good to see you</p>
            </div>
            <Link
              className="workspace-account-chip"
              href="/profile"
              aria-label={"Open profile for " + profile.name}
            >
              <span className="workspace-account-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5.5 19c.7-3.1 3-4.8 6.5-4.8s5.8 1.7 6.5 4.8" />
                </svg>
              </span>
              <span>
                <strong>{profile.name}</strong>
                <small>{profile.email || "Manage your profile"}</small>
              </span>
            </Link>
          </header>
          <div className="workspace-status">
            <AuthStatus status={status} tone="error" />
          </div>
          <section className="workspace-content">{children}</section>
        </div>
      </div>
    </main>
  );
}
