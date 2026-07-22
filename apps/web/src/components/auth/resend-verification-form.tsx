"use client";

import { useState } from "react";

export function ResendVerificationForm() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        const data = new FormData(event.currentTarget);
        const response = await fetch("/api/identity/verification/resend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.get("email") }),
        });
        const result = (await response.json()) as { message: string };
        setStatus(result.message);
        setBusy(false);
      }}
    >
      <label htmlFor="resend-email">Email address</label>
      <input
        id="resend-email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <button disabled={busy} type="submit">
        {busy ? "Sending…" : "Resend verification"}
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
