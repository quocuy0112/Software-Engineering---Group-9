"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountRecoveryCapability } from "@/frontend/features/authentication/client/use-account-recovery-capability";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { AuthStatus } from "./auth-status";
import { authCopy, localizedAuthMessage } from "./auth-copy";

export function AccountRecoveryCancellation() {
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
  const capability = useAccountRecoveryCapability("cancellation");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (busy || capability !== "authorized") return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/identity/account-recovery/cancel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setStatusTone(response.ok ? "success" : "error");
      setStatus(
        localizedAuthMessage(
          locale,
          result?.message,
          response.ok ? copy.recovery.cancelled : copy.recovery.cancellationError,
        ),
      );
      if (response.ok) setCancelled(true);
    } catch {
      setStatusTone("error");
      setStatus(copy.recovery.cancellationError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-form-content">
      <div className="auth-form">
        <div className="auth-form-heading">
          <p className="form-kicker">{copy.recovery.cancellationKicker}</p>
          <h1>{copy.recovery.cancellationTitle}</h1>
          <p>{copy.recovery.cancellationDescription}</p>
        </div>
        {capability === "authorizing" ? (
          <AuthStatus
            id="account-recovery-cancellation-status"
            status={copy.recovery.verifying}
          />
        ) : null}
        {capability === "authorized" && !cancelled ? (
          <button type="button" onClick={cancel} disabled={busy}>
            {busy ? copy.recovery.cancelling : copy.recovery.cancel}
          </button>
        ) : null}
        <AuthStatus
          id="account-recovery-cancellation-status"
          status={status}
          tone={statusTone}
        />
        <Link href="/login">{copy.common.returnToSignIn}</Link>
      </div>
    </section>
  );
}
