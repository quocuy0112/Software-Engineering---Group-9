"use client";

import { useEffect, useId } from "react";
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
  const generatedId = useId();

  useEffect(() => {
    if (!status) return;
    const messages = status
      .split(/\r?\n/)
      .map((message) => message.trim())
      .filter(Boolean);

    if (messages.length === 0) return;

    // The toast id is derived only from the field id + the line's position,
    // NOT from the message text or Date.now()/Math.random(). If the id
    // included the message content, a changed message (e.g. "4 attempts
    // remaining" -> "3 attempts remaining") would count as a brand new toast
    // and stack instead of replacing the previous one.
    messages.forEach((message, index) => {
      const toastId = `${generatedId}-${index}`;
      if (tone === "error") toast.error(message, { id: toastId });
      else if (tone === "success") toast.success(message, { id: toastId });
      else toast(message, { id: toastId });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tone]);

  return (
    <p id={id} role="status" aria-live="polite" data-tone={tone} className="sr-only">
      {status}
    </p>
  );
}