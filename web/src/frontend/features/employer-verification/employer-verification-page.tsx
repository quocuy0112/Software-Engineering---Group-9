"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./employer-verification-page.module.css";

type Item = {
  id: string;
  submittedCompanyName: string;
  normalizedTaxIdentifier: string;
  requestedRole: string;
  state: string;
  resubmissionCount: number;
  createdAt: string;
};

const statusPresentation: Record<
  string,
  {
    label: string;
    tone: "info" | "warning" | "success" | "danger" | "neutral";
  }
> = {
  PENDING_CHECKS: { label: "Safety checks", tone: "info" },
  PENDING_REVIEW: { label: "Under review", tone: "warning" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Not approved", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

function presentStatus(state: string) {
  return (
    statusPresentation[state] ?? {
      label: state.replaceAll("_", " ").toLowerCase(),
      tone: "neutral" as const,
    }
  );
}

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function EmployerVerificationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );
  const [busyRequestId, setBusyRequestId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const response = await fetch("/api/employer-verifications", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.ok) setItems((await response.json()).data);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/employer-verifications", {
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      if (active && response.ok) setItems((await response.json()).data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    const response = await fetch("/api/employer-verifications", {
      method: "POST",
      body: new FormData(form),
      credentials: "same-origin",
    });
    setMessageTone(response.ok ? "success" : "error");
    setMessage(
      response.ok
        ? "Verification request received."
        : "The request could not be accepted.",
    );
    if (response.ok) {
      form.reset();
      await load();
    }
    setSubmitting(false);
  }

  async function cancel(requestId: string) {
    setBusyRequestId(requestId);
    const response = await fetch(
      `/api/employer-verifications/${encodeURIComponent(requestId)}/cancel`,
      { method: "POST", credentials: "same-origin" },
    );
    setMessageTone(response.ok ? "success" : "error");
    setMessage(
      response.ok ? "Verification request cancelled." : "Cancellation failed.",
    );
    await load();
    setBusyRequestId(undefined);
  }

  async function resubmit(
    requestId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusyRequestId(requestId);
    const response = await fetch(
      `/api/employer-verifications/${encodeURIComponent(requestId)}/resubmit`,
      {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
      },
    );
    setMessageTone(response.ok ? "success" : "error");
    setMessage(
      response.ok
        ? "Replacement evidence received."
        : "Replacement evidence could not be accepted.",
    );
    if (response.ok) event.currentTarget.reset();
    await load();
    setBusyRequestId(undefined);
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Employer verification</p>
          <h1>Recruiter application</h1>
          <p className={styles.intro}>
            Verify your business once to unlock recruiter tools, publish jobs,
            and manage candidates with a trusted company identity.
          </p>
        </div>
        <div className={styles.trustNote}>
          <span className={styles.trustIcon} aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Private and protected</strong>
            <span>Your document is safety checked before human review.</span>
          </div>
        </div>
      </header>

      {message && (
        <p className={styles.message} data-tone={messageTone} role="status">
          {message}
        </p>
      )}

      <div className={styles.applicationGrid}>
        <section className={`${styles.card} ${styles.formCard}`}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>1</span>
            <div>
              <h2>Business information</h2>
              <p>Use the legal details shown on your business license.</p>
            </div>
          </div>

          <form onSubmit={submit} className={styles.form}>
            <input type="hidden" name="requestedRole" value="RECRUITER" />
            <label className={styles.field}>
              <span>Legal company name</span>
              <input
                name="companyName"
                required
                maxLength={240}
                placeholder="Example Technology Company Ltd."
              />
            </label>
            <label className={styles.field}>
              <span>Vietnamese tax identifier</span>
              <input
                aria-label="Vietnamese tax identifier"
                name="taxIdentifier"
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                placeholder="10-digit tax identifier"
              />
              <small>
                Enter exactly 10 digits without spaces or separators.
              </small>
            </label>
            <label className={`${styles.field} ${styles.fileField}`}>
              <span>Business license</span>
              <input
                aria-label="Business license"
                aria-describedby="business-license-help"
                name="document"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                required
              />
              <small id="business-license-help">
                PDF, PNG, or JPEG · Maximum file size 5 MB
              </small>
            </label>
            <button
              className={styles.primaryButton}
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Submitting…" : "Submit recruiter application"}
            </button>
          </form>
        </section>

        <aside className={`${styles.card} ${styles.processCard}`}>
          <p className={styles.eyebrow}>What happens next</p>
          <h2>A clear verification process</h2>
          <ol className={styles.processList}>
            <li>
              <span>1</span>
              <div>
                <strong>Automated safety check</strong>
                <p>We validate the file type and scan the document.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Administrator review</strong>
                <p>Your company details are reviewed securely.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Recruiter access</strong>
                <p>Approved accounts can start publishing jobs.</p>
              </div>
            </li>
          </ol>
          <div className={styles.requirementNote}>
            <strong>Before uploading</strong>
            <p>Make sure the company name and tax ID are clearly readable.</p>
          </div>
        </aside>
      </div>

      <section className={styles.historySection}>
        <div className={styles.historyHeading}>
          <div>
            <p className={styles.eyebrow}>Application history</p>
            <h2>Your recruiter applications</h2>
          </div>
          {items.length > 0 && (
            <span className={styles.applicationCount}>
              {items.length} {items.length === 1 ? "request" : "requests"}
            </span>
          )}
        </div>

        {items.length ? (
          <ul className={styles.applicationList}>
            {items.map((item) => {
              const status = presentStatus(item.state);
              return (
                <li className={styles.applicationCard} key={item.id}>
                  <div className={styles.applicationHeader}>
                    <div>
                      <strong>{item.submittedCompanyName}</strong>
                      <span>Submitted {formatSubmittedAt(item.createdAt)}</span>
                    </div>
                    <span
                      className={styles.statusBadge}
                      data-tone={status.tone}
                    >
                      {status.label}
                    </span>
                  </div>
                  <dl className={styles.applicationMeta}>
                    <div>
                      <dt>Tax identifier</dt>
                      <dd>{item.normalizedTaxIdentifier}</dd>
                    </div>
                    <div>
                      <dt>Requested role</dt>
                      <dd>{item.requestedRole.toLowerCase()}</dd>
                    </div>
                    <div>
                      <dt>Resubmissions</dt>
                      <dd>{item.resubmissionCount} of 3</dd>
                    </div>
                  </dl>

                  {[
                    "PENDING_CHECKS",
                    "PENDING_REVIEW",
                    "CHANGES_REQUESTED",
                  ].includes(item.state) && (
                    <button
                      className={styles.secondaryButton}
                      disabled={busyRequestId === item.id}
                      onClick={() => void cancel(item.id)}
                      type="button"
                    >
                      {busyRequestId === item.id
                        ? "Working…"
                        : "Cancel request"}
                    </button>
                  )}

                  {item.state === "CHANGES_REQUESTED" &&
                    item.resubmissionCount < 3 && (
                      <form
                        className={styles.resubmitForm}
                        onSubmit={(event) => void resubmit(item.id, event)}
                      >
                        <label className={styles.field}>
                          <span>Replacement business license</span>
                          <input
                            name="document"
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            required
                          />
                        </label>
                        <button
                          className={styles.primaryButton}
                          disabled={busyRequestId === item.id}
                          type="submit"
                        >
                          Resubmit evidence
                        </button>
                      </form>
                    )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">⌁</span>
            <div>
              <strong>No verification requests.</strong>
              <p>Your submitted applications will appear here.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
