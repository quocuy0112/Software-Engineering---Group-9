"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountRecoveryCapability } from "@/frontend/features/authentication/client/use-account-recovery-capability";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { authCopy, localizedAuthMessage } from "./auth-copy";

export function AccountRecoveryConfirmation() {
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
  const capability = useAccountRecoveryCapability("confirmation");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [holdEndsAt, setHoldEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy || capability !== "authorized") return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/confirm", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        holdEndsAt?: string;
      } | null;
      setStatusTone(response.ok ? "success" : "error");
      setStatus(
        localizedAuthMessage(
          locale,
          result?.message,
          copy.recovery.confirmationError,
        ),
      );
      if (response.ok && result?.holdEndsAt) setHoldEndsAt(result.holdEndsAt);
    } catch {
      setStatusTone("error");
      setStatus(copy.recovery.confirmationError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <div className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.recovery.confirmationKicker}</p>
          <h1>{copy.recovery.confirmationTitle}</h1>
          <p>{copy.recovery.confirmationDescription}</p>
        </div>
        {capability === "authorizing" ? (
          <AuthStatus
            id="account-recovery-confirmation-status"
            status={copy.recovery.verifying}
          />
        ) : null}
        {capability === "authorized" && !holdEndsAt ? (
          <button type="button" onClick={confirm} disabled={busy}>
            {busy ? copy.recovery.startingHold : copy.recovery.startHold}
          </button>
        ) : null}
        <AuthStatus
          id="account-recovery-confirmation-status"
          status={status}
          tone={statusTone}
        />
        {holdEndsAt ? (
          <p>
            {copy.recovery.holdEndsPrefix}{" "}
            <time dateTime={holdEndsAt}>{holdEndsAt}</time>. {" "}
            {copy.recovery.holdEndsDescription}
          </p>
        ) : null}
        <p>{copy.recovery.lowerAssurance}</p>
        <Link href="/login">{copy.common.returnToSignIn}</Link>
      </div>
    </section>
  );
}
