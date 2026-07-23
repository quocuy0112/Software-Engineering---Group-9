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
    if (!status) return;
    if (tone === "error") toast.error(status);
    else if (tone === "success") toast.success(status);
    else toast(status);
  }, [status, tone]);
  return (
    <p id={id} role="status" aria-live="polite">
      {status}
    </p>
  );
}
