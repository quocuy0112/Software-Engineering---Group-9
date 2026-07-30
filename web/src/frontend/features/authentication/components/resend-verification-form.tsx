"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AuthStatus } from "./auth-status";
import { resendVerificationMutationOptions } from "@/frontend/features/authentication/client/query-options";

export function ResendVerificationForm() {
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const resend = useMutation(
    resendVerificationMutationOptions(async () => {
      const response = await fetch("/api/identity/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message: string };
      setStatus(result.message);
      return { ok: response.ok };
    }),
  );
  const busy = resend.isPending;
  return (
    <form
      className="auth-form auth-form--compact"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        resend.mutate();
      }}
    >
      <label htmlFor="resend-email">Email address</label>
      <input
        id="resend-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button disabled={busy} type="submit">
        {busy ? "Sending…" : "Resend verification"}
      </button>
      <AuthStatus status={status} />
    </form>
  );
}
