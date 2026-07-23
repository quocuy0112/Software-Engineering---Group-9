"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  passwordProofSchema,
  totpCodeSchema,
  type PasswordProof,
  type TotpCode,
} from "@/features/identity/schemas/two-factor";
import { PasswordField } from "./password-field";
import { FormFeedback } from "./form-feedback";

type Setup = {
  qrCodeDataUrl: string;
  manualKey: string;
  issuer: string;
  accountLabel: string;
};
type Stage = "password" | "verify" | "complete";

/**
 * TOTP enrollment flow for the security settings page.
 *
 * Security posture: the QR data URL, manual key, and backup codes are held only
 * in transient React state. Nothing sensitive is written to localStorage,
 * sessionStorage, global stores, query caches, the URL, analytics, or logs, and
 * all sensitive state is cleared on completion, cancellation, and unmount.
 */
export function TotpEnrollment({
  onEnabled,
}: {
  onEnabled?: () => void;
}) {
  const [proof, setProof] = useState("");
  const [stage, setStage] = useState<Stage>("password");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const clearSensitive = useCallback(() => {
    setSetup(null);
    setBackupCodes([]);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/identity/sessions", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) return;
          const body = (await response.json()) as { csrfProof: string };
          setProof(body.csrfProof);
        } catch {
          // Navigation can abort this background request during route changes.
          return;
        }
      })();
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Warn before navigating away while backup codes are still on screen.
  useEffect(() => {
    if (backupCodes.length === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [backupCodes.length]);

  // Clear all sensitive state on unmount.
  useEffect(() => () => clearSensitive(), [clearSensitive]);

  const passwordForm = useForm<PasswordProof>({
    resolver: zodResolver(passwordProofSchema),
    defaultValues: { currentPassword: "" },
  });
  const codeForm = useForm<TotpCode>({
    resolver: zodResolver(totpCodeSchema),
    defaultValues: { code: "" },
  });

  const startEnrollment = passwordForm.handleSubmit(async (values) => {
    setStatus("");
    const response = await fetch("/api/identity/two-factor/enrollment", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": proof },
      body: JSON.stringify(values),
    });
    passwordForm.reset({ currentPassword: "" });
    if (!response.ok) {
      setStatus(
        response.status === 429
          ? "Too many attempts. Please wait and try again."
          : "Please confirm your current password to continue.",
      );
      return;
    }
    const body = (await response.json()) as Setup;
    setSetup(body);
    setStage("verify");
  });

  const verifyCode = codeForm.handleSubmit(async (values) => {
    setStatus("");
    const response = await fetch("/api/identity/two-factor/enrollment/verify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": proof },
      body: JSON.stringify(values),
    });
    codeForm.reset({ code: "" });
    if (!response.ok) {
      setStatus(
        response.status === 429
          ? "Too many attempts. Please wait and try again."
          : "That code could not be verified. Try again.",
      );
      return;
    }
    const body = (await response.json()) as { backupCodes: string[] };
    setSetup(null);
    setBackupCodes(body.backupCodes);
    setStage("complete");
    setStatus("Two-factor authentication is now enabled.");
    onEnabled?.();
  });

  function cancel() {
    clearSensitive();
    passwordForm.reset({ currentPassword: "" });
    codeForm.reset({ code: "" });
    setStage("password");
    setStatus("Enrollment cancelled.");
  }

  return (
    <section
      className="totp-enrollment security-panel"
      aria-labelledby="totp-title"
    >
      <div className="security-panel-heading">
        <span className="security-panel-icon" aria-hidden="true">
          ◇
        </span>
        <div>
          <p className="panel-kicker">RECOMMENDED</p>
          <h2 id="totp-title">Set up two-factor authentication</h2>
        </div>
      </div>

      {stage === "password" ? (
        <form
          onSubmit={startEnrollment}
          noValidate
          aria-busy={passwordForm.formState.isSubmitting}
        >
          <p>
            Confirm your current password to begin. You will scan a QR code with
            your authenticator app.
          </p>
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register("currentPassword")}
          />
          <button
            type="submit"
            disabled={passwordForm.formState.isSubmitting || !proof}
          >
            {passwordForm.formState.isSubmitting ? "Starting…" : "Continue"}
          </button>
          <FormFeedback status={status} />
        </form>
      ) : null}

      {stage === "verify" && setup ? (
        <form
          onSubmit={verifyCode}
          noValidate
          aria-busy={codeForm.formState.isSubmitting}
        >
          <p>
            Scan this QR code in your authenticator app for{" "}
            <strong>{setup.issuer}</strong> ({setup.accountLabel}).
          </p>
          {/* Base64 data-URL QR rendered server-side; next/image cannot optimize a data URI. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrCodeDataUrl}
            alt="QR code for two-factor authenticator enrollment"
            className="totp-qr"
            width={240}
            height={240}
          />
          <p className="totp-manual">
            Can&apos;t scan? Enter this setup key manually:
            <br />
            <code>{setup.manualKey}</code>
          </p>
          <div className="field">
            <label htmlFor="totp-code">Six-digit code</label>
            <input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={Boolean(codeForm.formState.errors.code)}
              {...codeForm.register("code")}
            />
            {codeForm.formState.errors.code ? (
              <p role="alert">{codeForm.formState.errors.code.message}</p>
            ) : null}
          </div>
          <button type="submit" disabled={codeForm.formState.isSubmitting}>
            {codeForm.formState.isSubmitting
              ? "Verifying…"
              : "Verify and enable"}
          </button>
          <button type="button" className="secondary-action" onClick={cancel}>
            Cancel
          </button>
          <FormFeedback status={status} />
        </form>
      ) : null}

      {stage === "complete" && backupCodes.length > 0 ? (
        <div aria-labelledby="backup-title">
          <h2 id="backup-title">Save your backup codes</h2>
          <p role="alert" data-warning>
            Store these ten backup codes somewhere safe now. They are shown only
            once and each can be used a single time if you lose your
            authenticator.
          </p>
          <ul className="backup-codes">
            {backupCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              clearSensitive();
              setStage("password");
              setStatus("Backup codes dismissed.");
            }}
          >
            I&apos;ve saved my backup codes
          </button>
          <FormFeedback status={status} />
        </div>
      ) : null}
    </section>
  );
}
