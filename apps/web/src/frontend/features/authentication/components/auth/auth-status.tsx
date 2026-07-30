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
    const messages = status
      .split(/\r?\n/)
      .map((message) => message.trim())
      .filter(Boolean);

    if (messages.length === 0) return;

    const baseToastId = id ?? "auth-status";
    messages.forEach((message, index) => {
      const toastId =
        messages.length === 1 ? baseToastId : `${baseToastId}-${index}`;
      if (tone === "error") toast.error(message, { id: toastId });
      else if (tone === "success") toast.success(message, { id: toastId });
      else toast(message, { id: toastId });
    });
  }, [id, status, tone]);

  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      data-tone={tone}
      className="sr-only"
    >
      {status}
    </p>
  );
}
