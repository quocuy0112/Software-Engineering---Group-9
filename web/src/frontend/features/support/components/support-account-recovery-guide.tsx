"use client";

import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { getSupportHelpCopy } from "../support-help-copy";

export function SupportAccountRecoveryGuide() {
  const locale = useWorkspaceLocale();
  const copy = getSupportHelpCopy(locale).recovery;

  return (
    <main className="support-help support-recovery-guide">
      <header className="support-help__header support-help__header--compact">
        <p className="support-help__eyebrow">
          <span aria-hidden="true" />
          {copy.eyebrow}
        </p>
        <h1 id="workspace-page-title">{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </header>

      <section
        className="support-recovery-guide__card"
        aria-labelledby="recovery-steps-heading"
      >
        <div className="support-recovery-guide__icon" aria-hidden="true">
          <RecoveryIcon />
        </div>
        <div>
          <h2 id="recovery-steps-heading">{copy.stepsHeading}</h2>
          <ol>
            {copy.steps.map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <aside className="support-recovery-guide__notice">
        <SafetyIcon />
        <div>
          <h2>{copy.safetyTitle}</h2>
          <p>{copy.safetyCopy}</p>
        </div>
      </aside>

      <nav className="support-recovery-guide__actions" aria-label={copy.title}>
        <Link className="support-help__primary-link" href="/forgot-password">
          {copy.resetPassword} <span aria-hidden="true">→</span>
        </Link>
        <Link className="support-help__secondary-link" href="/support">
          {copy.contactSupport}
        </Link>
      </nav>
      <Link className="support-recovery-guide__back" href="/support">
        <span aria-hidden="true">←</span> {copy.backToSupport}
      </Link>
    </main>
  );
}

function RecoveryIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 4a7.5 7.5 0 1 1-6.8 4.4" />
      <path d="M4 4v5h5M12 8v4l2.8 1.8" />
    </svg>
  );
}

function SafetyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" />
      <path d="m9.2 12 1.9 1.9 3.8-4" />
    </svg>
  );
}
