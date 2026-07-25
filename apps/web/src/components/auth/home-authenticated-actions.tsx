"use client";

import Link from "next/link";
import { useState } from "react";
import { currentCsrfProof } from "@/features/identity/client/current-csrf-proof";
import { AuthStatus } from "./auth-status";

export function HomeAuthenticatedActions({
  profile,
  csrfProof,
}: {
  profile: { name: string; email: string };
  csrfProof: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const proof = await currentCsrfProof(csrfProof);
      const response = await fetch("/api/identity/logout", {
        method: "POST",
        headers: { "x-csrf-token": proof },
      });
      if (!response.ok) {
        setStatus("Unable to sign out. Please try again.");
        return;
      }
      window.location.assign("/login");
    } catch {
      setStatus("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home-authenticated">
      <header className="home-header">
        <Link className="smart-hire-brand home-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>SmartHire</span>
        </Link>
        <div className="home-account">
          <Link
            className="home-profile-link"
            href="/profile"
            aria-label={`Open profile for ${profile.name}`}
          >
            <span className="home-profile-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 19c.7-3.1 3-4.8 6.5-4.8s5.8 1.7 6.5 4.8" />
              </svg>
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>{profile.email}</small>
            </span>
          </Link>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <section className="home-authenticated-hero" aria-labelledby="home-title">
        <p className="home-eyebrow">THE TALENT CONNECTION</p>
        <h1 id="home-title">Make your next great move.</h1>
        <p>
          Your secure SmartHire workspace is ready when you are. Keep your
          identity protected and shape what comes next.
        </p>
        <nav className="home-actions" aria-label="Workspace actions">
          <Link className="home-action home-action--primary" href="/dashboard">
            Dashboard
          </Link>
          <Link className="home-action home-action--secondary" href="/profile">
            Profile
          </Link>
        </nav>
      </section>
      <AuthStatus status={status} tone="error" />
    </div>
  );
}
