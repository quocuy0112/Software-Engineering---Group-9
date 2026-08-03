"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { postWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";

export function HomeAuthenticatedActions({
  profile,
  csrfProof,
}: {
  profile: { name: string; email: string; image?: string | null };
  csrfProof: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [status, setStatus] = useState("");
  const avatar = /^data:image\/(?:png|jpeg);base64,/u.test(profile.image ?? "")
    ? profile.image
    : null;

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
    <div className="home-authenticated">
      <header className="home-header">
        <SmartHireBrand className="home-brand" />
        <div className="home-account">
          <Link
            className="home-profile-link"
            href="/profile"
            aria-label={`Open profile for ${profile.name}`}
          >
            <span className="home-profile-icon" aria-hidden="true">
              {avatar ? (
                <Image src={avatar} alt="" width={40} height={40} unoptimized />
              ) : (
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5.5 19c.7-3.1 3-4.8 6.5-4.8s5.8 1.7 6.5 4.8" />
                </svg>
              )}
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>{profile.email}</small>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy || navigating}
          >
            {busy || navigating ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <section className="home-authenticated-hero" aria-labelledby="home-title">
        <p className="home-eyebrow">YOUR NEXT CHAPTER, ORGANIZED</p>
        <h1 id="home-title">
          Everything you bring. One place to move forward.
        </h1>
        <p>
          Your secure SmartHire workspace keeps your identity, professional
          story, and next steps clear—so you can focus on where you want to go.
        </p>
        <nav className="home-actions" aria-label="Workspace actions">
          <Link className="home-action home-action--primary" href="/jobs">
            Browse jobs
          </Link>
          <Link className="home-action home-action--secondary" href="/dashboard">
            Dashboard
          </Link>
        </nav>
      </section>
      <AuthStatus status={status} tone="error" />
    </div>
  );
}
