"use client";

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
  if (!applyHref && !onApply) return null;

  return (
    <nav
      className="job-sticky-mini-nav job-sticky-mini-nav--actions"
      aria-label="Job actions"
    >
      {applyHref ? (
        <a className="job-mini-nav-apply" href={applyHref}>
          Sign in to apply
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
          {applyOpen ? "Hide application form" : "Apply now"}
        </button>
      ) : null}
    </nav>
  );
}
