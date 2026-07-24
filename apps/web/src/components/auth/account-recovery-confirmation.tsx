"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthStatus } from "./auth-status";

export function AccountRecoveryConfirmation() {
  const [status, setStatus] = useState("Confirming your recovery request…");
  const [holdEndsAt, setHoldEndsAt] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get(
      "proof",
    );
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      if (!value) {
        setStatus(
          "This account-recovery link is invalid, expired, or already used.",
        );
        return;
      }
      try {
        const response = await fetch("/api/identity/account-recovery/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof: value }),
        });
        const result = (await response.json().catch(() => null)) as {
          message?: string;
          holdEndsAt?: string;
        } | null;
        setStatus(result?.message ?? "The recovery request could not be confirmed.");
        if (response.ok && result?.holdEndsAt) setHoldEndsAt(result.holdEndsAt);
      } catch {
        setStatus("The recovery request could not be confirmed.");
      } finally {
      }
    })();
  }, []);

  return (
    <section className="auth-form-content">
      <div className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">SECURITY HOLD</p>
          <h1>Recovery request received</h1>
          <p>
            We revoke existing access and start a 24-hour hold before any
            password or factor change.
          </p>
        </div>
        <AuthStatus status={status} />
        {holdEndsAt ? (
          <p>
            Hold ends at <time dateTime={holdEndsAt}>{holdEndsAt}</time>. Check
            your email for one-time cancellation and completion links.
          </p>
        ) : null}
        <p>
          Email-only recovery is lower assurance than using your password and
          second factor.
        </p>
        <Link href="/login">Return to sign in</Link>
      </div>
    </section>
  );
}
