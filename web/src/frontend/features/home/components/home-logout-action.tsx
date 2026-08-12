"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";

export function HomeLogoutAction({
  csrfProof,
  labels,
}: {
  csrfProof: string;
  labels: {
    logout: string;
    loggingOut: string;
    logoutSuccess: string;
    logoutError: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<
    { tone: "status" | "alert"; message: string } | undefined
  >();
  async function logout() {
    if (pending) return;
    setPending(true);
    setFeedback(undefined);
    try {
      const response = await postWithCurrentCsrf(
        "/api/identity/logout",
        csrfProof,
      );
      if (response.status === 401) {
        router.replace("/");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      setFeedback({ tone: "status", message: labels.logoutSuccess });
      router.replace("/");
      router.refresh();
    } catch {
      setFeedback({ tone: "alert", message: labels.logoutError });
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="home-logout">
      <button type="button" onClick={() => void logout()} disabled={pending}>
        {pending ? labels.loggingOut : labels.logout}
      </button>
      {feedback ? (
        <span role={feedback.tone}>{feedback.message}</span>
      ) : null}
    </span>
  );
}
