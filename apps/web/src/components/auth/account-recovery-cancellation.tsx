"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthStatus } from "./auth-status";

export function AccountRecoveryCancellation() {
  const [status, setStatus] = useState("Cancelling recovery…");

  useEffect(() => {
    const proof = new URLSearchParams(window.location.hash.slice(1)).get(
      "proof",
    );
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      if (!proof) {
        setStatus(
          "This account-recovery link is invalid, expired, or already used.",
        );
        return;
      }
      try {
        const response = await fetch("/api/identity/account-recovery/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof }),
        });
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setStatus(
          result?.message ??
            "Recovery was cancelled. Sign in with your existing password and second factor.",
        );
      } catch {
        setStatus("The account-recovery link is invalid, expired, or already used.");
      }
    })();
  }, []);

  return (
    <section className="auth-form-content">
      <div className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">RECOVERY CANCELLED</p>
          <h1>Your account is unchanged</h1>
        </div>
        <AuthStatus status={status} />
        <p>Your existing password and second factor remain authoritative.</p>
        <Link href="/login">Sign in</Link>
      </div>
    </section>
  );
}
