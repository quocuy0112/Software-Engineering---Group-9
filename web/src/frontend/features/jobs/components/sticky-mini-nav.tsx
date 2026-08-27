"use client";

import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobCopy } from "./job-copy";

export function StickyMiniNav({
  onApply,
  applyOpen = false,
  applyDisabled = false,
  applyHref,
}: {
  onApply?: () => void;
  applyOpen?: boolean;
  applyDisabled?: boolean;
  applyHref?: string;
}) {
  const copy = jobCopy(useWorkspaceLocale());
  if (!applyHref && !onApply) return null;

  return (
    <nav
      className="job-sticky-mini-nav job-sticky-mini-nav--actions"
      aria-label={copy.jobActions}
    >
      {applyHref ? (
        <a className="job-mini-nav-apply" href={applyHref}>
          {copy.signInToApply}
        </a>
      ) : onApply ? (
        <button
          type="button"
          className="job-mini-nav-apply"
          aria-controls="apply"
          aria-expanded={applyOpen}
          disabled={applyDisabled}
          onClick={onApply}
        >
          {applyOpen ? copy.hideApplicationForm : copy.applyNow}
        </button>
      ) : null}
    </nav>
  );
}
