"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

function VerificationResult() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"checking" | "success" | "failure">(() =>
    token && token.length >= 32 ? "checking" : "failure",
  );
  useEffect(() => {
    if (!token || token.length < 32) return;
    void fetch("/api/identity/verification/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => setState(response.ok ? "success" : "failure"))
      .catch(() => setState("failure"));
  }, [token]);
  if (state === "checking")
    return (
      <>
        <h1>Verifying your email</h1>
        <p role="status">Please wait…</p>
      </>
    );
  if (state === "success")
    return (
      <>
        <h1>Email verified</h1>
        <p role="status">
          Your account is active. You can now continue to login.
        </p>
        <Link href="/login">Continue to login</Link>
      </>
    );
  return (
    <>
      <h1>Verification link unavailable</h1>
      <p role="alert">
        The link is invalid, expired, already used, or cannot be processed
        safely.
      </p>
      <ResendVerificationForm />
      <Link href="/login">Back to sign in</Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p role="status">Loading verification…</p>}>
      <VerificationResult />
    </Suspense>
  );
}
