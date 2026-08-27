"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { employerVerificationCopy } from "./employer-verification-copy";

type ConfirmationState =
  | "CHECKING"
  | "SIGN_IN_REQUIRED"
  | "INVALID"
  | "RETRYABLE";

const tokenParameter = "company-email-token";

export function CompanyEmailVerificationLanding() {
  const copy = employerVerificationCopy(useWorkspaceLocale());
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<ConfirmationState>("CHECKING");

  const confirm = useCallback(
    async (token: string) => {
      setState("CHECKING");
      try {
        const response = await fetch(
          "/api/employer-verifications/company-email/confirm",
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );
        if (response.ok) {
          router.replace(
            "/dashboard/employer-verification?companyEmailVerified=1",
          );
          return;
        }
        setState(response.status === 401 ? "SIGN_IN_REQUIRED" : response.status === 400 ? "INVALID" : "RETRYABLE");
      } catch {
        setState("RETRYABLE");
      }
    },
    [router],
  );

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      tokenParameter,
    );
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    if (!token || token.length < 43 || token.length > 128) {
      queueMicrotask(() => setState("INVALID"));
      return;
    }
    tokenRef.current = token;
    queueMicrotask(() => void confirm(token));
  }, [confirm]);

  const retry = () => {
    if (tokenRef.current) void confirm(tokenRef.current);
  };

  return (
    <section className="auth-form" aria-live="polite" aria-busy={state === "CHECKING"}>
      <div className="auth-form-heading">
        <p className="form-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>

      {state === "CHECKING" ? <p>{copy.checking}</p> : null}

      {state === "SIGN_IN_REQUIRED" ? (
        <>
          <p role="alert">{copy.signInRequired}</p>
          <Link
            href="/login?returnTo=%2Fdashboard%2Femployer-verification"
            target="_blank"
            rel="noopener noreferrer"
          >
            {copy.openSignIn}
          </Link>
          <button type="button" onClick={retry}>{copy.retry}</button>
        </>
      ) : null}

      {state === "INVALID" ? (
        <>
          <p role="alert">{copy.invalid}</p>
          <Link href="/dashboard/employer-verification">
            {copy.returnToVerification}
          </Link>
        </>
      ) : null}

      {state === "RETRYABLE" ? (
        <>
          <p role="alert">{copy.retryable}</p>
          <button type="button" onClick={retry}>{copy.retry}</button>
        </>
      ) : null}
    </section>
  );
}
