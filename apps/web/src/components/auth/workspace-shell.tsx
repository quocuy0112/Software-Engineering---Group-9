"use client";

import Link from "next/link";
import { useState } from "react";
import { WorkspaceNavigation } from "./workspace-navigation";
import { AuthStatus } from "./auth-status";

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
      <div className="workspace-status"><AuthStatus status={status} tone="error" /></div>
      <section className="workspace-content">{children}</section>
    </main>
  );
}
