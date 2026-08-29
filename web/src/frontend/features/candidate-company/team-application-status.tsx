"use client";

import Link from "next/link";
import { useState } from "react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { PageHeader } from "@/frontend/components/layout/page-header";
import {
  candidateTeamApplicationListSchema,
  candidateTeamApplicationSchema,
  type CandidateTeamApplication,
} from "@/shared/contracts/company-members/team-applications";
import styles from "./candidate-company-screen.module.css";
import { getCompanyCopy } from "./i18n/company-copy";

function formatDate(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function invitationLabel(
  status: CandidateTeamApplication["invitationStatus"],
  copy: ReturnType<typeof getCompanyCopy>,
) {
  return status ? copy.invitationStatus(status) : copy.noInvitation;
}

function messageFrom(
  body: unknown,
  copy: ReturnType<typeof getCompanyCopy>,
  fallback: string,
) {
  if (body && typeof body === "object") {
    const code =
      "code" in body && typeof body.code === "string" ? body.code : undefined;
    const localized = copy.teamApplicationError(code);
    if (localized) return localized;
    if ("message" in body && typeof body.message === "string")
      return body.message;
  }
  return fallback;
}

export function TeamApplicationStatus({
  initialApplications,
}: {
  initialApplications: readonly CandidateTeamApplication[];
}) {
  const locale = useWorkspaceLocale();
  const copy = getCompanyCopy(locale);
  const csrf = useCsrfProof();
  const [applications, setApplications] = useState([...initialApplications]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingWithdrawal, setPendingWithdrawal] =
    useState<CandidateTeamApplication | null>(null);

  async function refresh() {
    const response = await fetch("/api/candidate/team-applications", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(copy.refreshError);
    const result = candidateTeamApplicationListSchema.parse(
      await response.json(),
    );
    setApplications(result.items);
  }

  async function withdraw(application: CandidateTeamApplication) {
    const applicationId = application.applicationId;
    setBusyId(applicationId);
    setError(null);
    setNotice(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/candidate/team-applications/${encodeURIComponent(applicationId)}`,
        { method: "DELETE" },
        csrf,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(messageFrom(body, copy, copy.withdrawError));
      }
      setApplications((current) =>
        current.map((item) =>
          item.applicationId === applicationId
            ? candidateTeamApplicationSchema.parse(body)
            : item,
        ),
      );
      setPendingWithdrawal(null);
      setNotice(copy.withdrawSuccess(application.companyName));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.withdrawError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className={styles.page} aria-labelledby="team-applications-title">
      <PageHeader
        className={styles.heading}
        eyebrow={copy.applicationsEyebrow}
        title={copy.teamApplications}
        titleId="team-applications-title"
        subtitle={copy.trackTeamApplications}
        rightSlot={
          <button
            className={`${styles.button} ${styles.secondary}`}
            type="button"
            onClick={() =>
              void refresh().catch((caught) =>
                setError(
                  caught instanceof Error
                    ? caught.message
                    : copy.unableToRefresh,
                ),
              )
            }
          >
            {copy.refresh}
          </button>
        }
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.success} role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}
      {applications.length ? (
        <div className={styles.statusList}>
          {applications.map((application) => (
            <article
              className={styles.statusCard}
              key={application.applicationId}
            >
              <div className={styles.statusLine}>
                <div>
                  <h2>{application.companyName}</h2>
                  <p>{copy.roleLabel(application.appliedRole)}</p>
                </div>
                <span className={styles.statusBadge}>
                  {copy.statusLabel(application.status)}
                </span>
              </div>
              <div className={styles.statusMeta}>
                <span>
                  {copy.submittedOn(
                    formatDate(application.submittedAt, locale),
                  )}
                </span>
                <span>
                  {invitationLabel(application.invitationStatus, copy)}
                </span>
                <span>
                  {application.ownerViewed
                    ? copy.ownerViewedOn(
                        formatDate(application.ownerFirstViewedAt!, locale),
                      )
                    : copy.ownerNotViewed}
                </span>
              </div>
              {application.invitationStatus === "PENDING" &&
              application.invitationExpiresAt ? (
                <p>
                  {copy.invitationExpiresOn(
                    formatDate(application.invitationExpiresAt, locale),
                  )}
                </p>
              ) : null}
              <div className={styles.teamLinks}>
                <Link
                  className={`${styles.teamLink} ${styles.secondary}`}
                  href={`/company/${encodeURIComponent(application.companyId)}`}
                >
                  {copy.viewCompanyLink}
                </Link>
                {application.status === "INVITATION_SENT" &&
                application.invitationStatus === "PENDING" &&
                application.invitationId ? (
                  <Link
                    className={styles.teamLink}
                    href={`/recruiter/company-invitation?invitationId=${encodeURIComponent(application.invitationId)}`}
                  >
                    {copy.reviewInvitation}
                  </Link>
                ) : null}
                {application.status === "SUBMITTED" ||
                application.status === "VIEWED" ? (
                  <button
                    className={`${styles.button} ${styles.secondary}`}
                    type="button"
                    disabled={busyId === application.applicationId}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setPendingWithdrawal(application);
                    }}
                  >
                    {busyId === application.applicationId
                      ? copy.withdrawing
                      : copy.withdraw}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty} role="status">
          <strong>{copy.noTeamApplications}</strong>
          <span>{copy.noTeamApplicationsDescription}</span>
          <Link className={styles.teamLink} href="/company">
            {copy.browseCompanies}
          </Link>
        </div>
      )}
      {pendingWithdrawal ? (
        <div className={styles.dialogBackdrop}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-team-application-title"
          >
            <h2 id="withdraw-team-application-title">
              {copy.withdrawDialogTitle}
            </h2>
            <p>
              {copy.withdrawDialogDescription(
                pendingWithdrawal.companyName,
                copy.roleLabel(pendingWithdrawal.appliedRole),
              )}
            </p>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.button} ${styles.secondary}`}
                type="button"
                disabled={busyId === pendingWithdrawal.applicationId}
                onClick={() => setPendingWithdrawal(null)}
              >
                {copy.cancelAction}
              </button>
              <button
                className={styles.button}
                type="button"
                disabled={busyId === pendingWithdrawal.applicationId}
                onClick={() => void withdraw(pendingWithdrawal)}
              >
                {busyId === pendingWithdrawal.applicationId
                  ? copy.withdrawing
                  : copy.confirmWithdraw}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
