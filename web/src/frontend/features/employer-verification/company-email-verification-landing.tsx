"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ConfirmationState =
  | "CHECKING"
  | "SIGN_IN_REQUIRED"
  | "INVALID"
  | "RETRYABLE";

const tokenParameter = "company-email-token";

export function CompanyEmailVerificationLanding() {
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
        <p className="form-kicker">COMPANY EMAIL</p>
        <h1>Verify company mailbox</h1>
        <p>
          This confirms mailbox control for your employer verification request.
        </p>
      </div>

      {state === "CHECKING" ? <p>Checking your verification link…</p> : null}

      {state === "SIGN_IN_REQUIRED" ? (
        <>
          <p role="alert">
            Sign in as the Candidate who requested this link, then return here
            and retry.
          </p>
          <Link
            href="/login?returnTo=%2Fdashboard%2Femployer-verification"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open sign in in a new tab
          </Link>
          <button type="button" onClick={retry}>Retry verification</button>
        </>
      ) : null}

      {state === "INVALID" ? (
        <>
          <p role="alert">
            This link is invalid, expired, already used, or belongs to another
            account. Request a new link from the employer verification page.
          </p>
          <Link href="/dashboard/employer-verification">Return to verification</Link>
        </>
      ) : null}

      {state === "RETRYABLE" ? (
        <>
          <p role="alert">
            Verification could not be completed. Check your connection and try
            again.
          </p>
          <button type="button" onClick={retry}>Retry verification</button>
        </>
      ) : null}
    </section>
  );
}
