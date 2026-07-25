"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function AuthStatus({
  status,
  tone = "message",
  id,
}: {
  status: string;
  tone?: "message" | "error" | "success";
  id?: string;
}) {
  useEffect(() => {
    const toastId = id ?? "auth-status";
    if (!status) {
      toast.dismiss(toastId);
      return;
    }
    const toastOptions = { id: toastId };
    if (tone === "error") toast.error(status, toastOptions);
    else if (tone === "success") toast.success(status, toastOptions);
    else toast(status, toastOptions);
  }, [id, status, tone]);
  return (
    <p id={id} role="status" aria-live="polite">
      {status}
    </p>
  );
}
