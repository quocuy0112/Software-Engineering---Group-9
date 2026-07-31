"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Alert, type AlertTone } from "@/frontend/components/ui/alert";

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
    const toastFallback = toast as unknown as {
      info?: (message: string, options: { id: string }) => void;
    };
    messages.forEach((message, index) => {
      const toastId =
        messages.length === 1 ? baseToastId : `${baseToastId}-${index}`;
      if (tone === "error") toast.error(message, { id: toastId });
      else if (tone === "success") toast.success(message, { id: toastId });
      else if (typeof toast === "function") toast(message, { id: toastId });
      else toastFallback.info?.(message, { id: toastId });
    });
  }, [id, status, tone]);

  const alertTone: AlertTone = tone === "message" ? "info" : tone;

  return status ? (
    <Alert
      id={id}
      role="status"
      aria-live="polite"
      tone={alertTone}
      className="auth-status"
    >
      {status}
    </Alert>
  ) : null;
}
