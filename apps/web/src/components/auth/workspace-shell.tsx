"use client";

import Link from "next/link";
import { useState } from "react";
import { WorkspaceNavigation } from "./workspace-navigation";

export function WorkspaceShell({
  children,
  csrfProof,
}: {
  children: React.ReactNode;
  csrfProof: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfProof },
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
    <main className="workspace-page">
      <header className="workspace-header">
        <Link className="smart-hire-brand" href="/">
          SmartHire
        </Link>
        <WorkspaceNavigation busy={busy} onSignOut={() => void signOut()} />
      </header>
      <p className="workspace-status" role="status" aria-live="polite">
        {status}
      </p>
      <section className="workspace-content">{children}</section>
    </main>
  );
}
