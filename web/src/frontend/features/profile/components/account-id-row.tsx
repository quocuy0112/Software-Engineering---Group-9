"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { InfoRow } from "@/frontend/components/ui/info-row";

type CopyState = "idle" | "copied" | "failed";

export function AccountIdRow({
  accountId,
  label,
  copyLabel,
  copiedLabel,
  failedLabel,
  icon,
}: {
  accountId: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  failedLabel: string;
  icon?: ReactNode;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyAccountId() {
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(accountId);
          copied = true;
        } catch {
          // Some non-secure or embedded contexts expose Clipboard but reject writes.
        }
      }

      if (!copied) {
        const fallback = document.createElement("textarea");
        fallback.value = accountId;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.append(fallback);
        try {
          fallback.select();
          copied = document.execCommand("copy");
        } finally {
          fallback.remove();
        }
      }

      if (!copied) throw new Error("CLIPBOARD_UNAVAILABLE");
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 2_500);
  }

  const feedback =
    copyState === "copied"
      ? copiedLabel
      : copyState === "failed"
        ? failedLabel
        : "";

  return (
    <InfoRow
      asDefinition
      className="sh-info-row--account-id"
      icon={icon}
      label={label}
      value={
        <span className="profile-account-id-value">
          <code>{accountId}</code>
          <button
            type="button"
            aria-label={copyState === "copied" ? copiedLabel : copyLabel}
            data-state={copyState}
            onClick={() => void copyAccountId()}
          >
            {copyState === "copied" ? (
              <Check aria-hidden="true" size={18} />
            ) : (
              <Copy aria-hidden="true" size={18} />
            )}
          </button>
          {feedback ? (
            <span className="sr-only" role="status" aria-live="polite">
              {feedback}
            </span>
          ) : null}
        </span>
      }
    />
  );
}
