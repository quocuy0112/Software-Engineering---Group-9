"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export function AccountIdRow({
  accountId,
  label,
  copyLabel,
  copiedLabel,
  failedLabel,
}: {
  accountId: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  failedLabel: string;
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
      if (!navigator.clipboard) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(accountId);
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
    <div>
      <dt>{label}</dt>
      <dd className="profile-account-id-value">
        <code>{accountId}</code>
        <button
          type="button"
          aria-label={copyState === "copied" ? copiedLabel : copyLabel}
          title={copyState === "copied" ? copiedLabel : copyLabel}
          data-state={copyState}
          onClick={() => void copyAccountId()}
        >
          {copyState === "copied" ? (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <rect x="9" y="9" width="10" height="10" rx="2" />
              <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            </svg>
          )}
        </button>
        {feedback ? (
          <span className="sr-only" role="status" aria-live="polite">
            {feedback}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
