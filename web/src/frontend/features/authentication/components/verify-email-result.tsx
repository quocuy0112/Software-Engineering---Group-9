"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { ResendVerificationForm } from "./resend-verification-form";
import { authCopy } from "./auth-copy";

export function VerifyEmailLoading() {
  const copy = authCopy(useWorkspaceLocale());
  return <p role="status">{copy.verifyEmail.wait}</p>;
}

export function VerifyEmailResult() {
  const copy = authCopy(useWorkspaceLocale());
  const token = useSearchParams().get("token");
  const attemptedToken = useRef<string | null>(null);
  const [state, setState] = useState<"checking" | "success" | "failure">(() =>
    token && token.length >= 32 ? "checking" : "failure",
  );

  useEffect(() => {
    if (!token || token.length < 32) return;
    if (attemptedToken.current === token) return;
    attemptedToken.current = token;

    void fetch("/api/identity/verification/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => setState(response.ok ? "success" : "failure"))
      .catch(() => setState("failure"));
  }, [token]);

  if (state === "checking") {
    return (
      <>
        <h1>{copy.verifyEmail.verifying}</h1>
        <p role="status">{copy.verifyEmail.wait}</p>
      </>
    );
  }

  if (state === "success") {
    return (
      <>
        <h1>{copy.verifyEmail.verified}</h1>
        <p role="status">
          {copy.verifyEmail.verifiedDescription}
        </p>
        <Link href="/login">{copy.verifyEmail.continueToLogin}</Link>
      </>
    );
  }

  return (
    <>
      <h1>{copy.verifyEmail.unavailable}</h1>
      <p role="alert">
        {copy.verifyEmail.unavailableDescription}
      </p>
      <ResendVerificationForm />
      <Link href="/login">{copy.common.backToSignIn}</Link>
    </>
  );
}
