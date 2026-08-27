"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  ownerTeamApplicationSchema,
  type OwnerTeamApplication,
  type TeamRole,
} from "@/shared/contracts/company-members/team-applications";
import {
  formatCompanyTeamApplicationDate,
  getCompanyTeamApplicationsCopy,
} from "./company-team-applications-copy";
import styles from "./company-team-applications-screen.module.css";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function messageFrom(
  body: unknown,
  copy: ReturnType<typeof getCompanyTeamApplicationsCopy>,
  fallback: string,
) {
  if (body && typeof body === "object") {
    const code =
      "code" in body && typeof body.code === "string" ? body.code : undefined;
    const localized = copy.errorForCode(code);
    if (localized) return localized;
    if ("message" in body && typeof body.message === "string")
      return body.message;
  }
  return fallback;
}

export function CompanyTeamApplicationsScreen({
  initialApplications,
  companyId,
}: {
  initialApplications: readonly OwnerTeamApplication[];
  companyId?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = getCompanyTeamApplicationsCopy(locale);
  const csrf = useCsrfProof();
  const [applications, setApplications] = useState([...initialApplications]);
  const [selectedId, setSelectedId] = useState(
    initialApplications[0]?.applicationId ?? null,
  );
  const [selected, setSelected] = useState<OwnerTeamApplication | null>(
    initialApplications[0] ?? null,
  );
  const [role, setRole] = useState<TeamRole>(
    initialApplications[0]?.appliedRole ?? "RECRUITER",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<
    "accept" | "reject" | null
  >(null);

  const pendingCount = useMemo(
    () =>
      applications.filter(
        (item) => item.status === "SUBMITTED" || item.status === "VIEWED",
      ).length,
    [applications],
  );

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void fetch(
      `/api/recruiter/company/team/applications/${encodeURIComponent(selectedId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(messageFrom(body, copy, copy.loadError));
        return ownerTeamApplicationSchema.parse(body);
      })
      .then((detail) => {
        if (cancelled) return;
        setSelected(detail);
        setApplications((current) =>
          current.map((item) =>
            item.applicationId === detail.applicationId ? detail : item,
          ),
        );
        setRole(detail.appliedRole);
      })
      .catch((caught) => {
        if (!cancelled)
          setError(caught instanceof Error ? caught.message : copy.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [copy, selectedId]);

  function selectApplication(applicationId: string) {
    const seed = applications.find(
      (item) => item.applicationId === applicationId,
    );
    if (seed) {
      setSelected(seed);
      setRole(seed.appliedRole);
    }
    setError(null);
    setNotice(null);
    setPendingDecision(null);
    setSelectedId(applicationId);
  }

  function requestDecision(decision: "accept" | "reject") {
    if (!selected) return;
    setError(null);
    setNotice(null);
    setPendingDecision(decision);
  }

  async function decide(decision: "accept" | "reject") {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/recruiter/company/team/applications/${encodeURIComponent(selected.applicationId)}/${decision}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            decision === "accept"
              ? { role }
              : { reason: reason.trim() || undefined },
          ),
        },
        csrf,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(messageFrom(body, copy, copy.decisionError(decision)));
      const next =
        decision === "accept"
          ? {
              ...selected,
              status: "INVITATION_SENT" as const,
              invitationStatus: "PENDING" as const,
              invitationEmailStatus: "PENDING" as const,
              decidedAt: new Date().toISOString(),
            }
          : {
              ...selected,
              status: "REJECTED" as const,
              invitationStatus: null,
              rejectionReason: reason.trim() || null,
              decidedAt: new Date().toISOString(),
            };
      setSelected(next);
      setApplications((current) =>
        current.map((item) =>
          item.applicationId === next.applicationId ? next : item,
        ),
      );
      setReason("");
      setPendingDecision(null);
      setNotice(
        decision === "accept" ? copy.acceptSuccess : copy.rejectSuccess,
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : copy.genericDecisionError,
      );
      setPendingDecision(null);
    } finally {
      setBusy(false);
    }
  }

  const reviewable =
    selected?.status === "SUBMITTED" || selected?.status === "VIEWED";
  const retryable =
    selected?.status === "INVITATION_SENT" &&
    selected.invitationStatus === "PENDING" &&
    (selected.invitationEmailStatus === "DEAD" ||
      selected.invitationEmailStatus === "RETRYABLE");

  return (
    <main className={styles.page} aria-labelledby="team-applications-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{copy.manageTeam}</p>
          <h1 id="team-applications-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.pendingBadge}>
            {copy.pendingDecision(pendingCount)}
          </span>
          <Link
            className={`${styles.link} ${styles.secondary}`}
            href={`/recruiter/company-settings/team${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`}
          >
            {copy.manageTeamLink}
          </Link>
        </div>
      </header>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className={styles.success} role="status" aria-live="polite">
          {notice}
        </p>
      ) : (
        <p className={styles.notice} role="status" aria-live="polite">
          {selectedId ? copy.refreshSelection : ""}
        </p>
      )}
      {applications.length ? (
        <div className={styles.layout}>
          <section
            className={styles.listPanel}
            aria-labelledby="team-application-list-title"
          >
            <div className={styles.panelHeading}>
              <h2 id="team-application-list-title">{copy.candidateCvs}</h2>
              <p>{copy.applicationCount(applications.length)}</p>
            </div>
            <div className={styles.list} role="list">
              {applications.map((application) => (
                <div key={application.applicationId} role="listitem">
                  <button
                    className={styles.applicationCard}
                    data-selected={application.applicationId === selectedId}
                    type="button"
                    onClick={() => selectApplication(application.applicationId)}
                  >
                    <span className={styles.applicationTop}>
                      <span>
                        <span className={styles.applicationTitle}>
                          {application.candidateName}
                        </span>
                        <span className={styles.applicationMeta}>
                          {copy.roleLabel(application.appliedRole)} ·{" "}
                          {formatCompanyTeamApplicationDate(
                            application.submittedAt,
                            locale,
                          )}
                        </span>
                      </span>
                      <span className={styles.statusBadge}>
                        {copy.statusLabel(application.status)}
                      </span>
                    </span>
                    <span className={styles.applicationFooter}>
                      <span className={styles.applicationMeta}>
                        {application.applicationEmail}
                      </span>
                      {application.ownerViewed ? (
                        <span className={styles.viewedBadge}>
                          {copy.viewed}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section
            className={styles.detailPanel}
            aria-labelledby="team-application-detail-title"
            aria-live="polite"
          >
            {selected ? (
              <>
                <header className={styles.detailHeader}>
                  <p className={styles.eyebrow}>{copy.applicationDetail}</p>
                  <h2 id="team-application-detail-title">
                    {selected.candidateName}
                  </h2>
                  <p>{selected.applicationEmail}</p>
                </header>
                <div className={styles.detailBody}>
                  <dl className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <dt>{copy.appliedRole}</dt>
                      <dd>{copy.roleLabel(selected.appliedRole)}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>{copy.submitted}</dt>
                      <dd>
                        {formatCompanyTeamApplicationDate(
                          selected.submittedAt,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>{copy.currentStatus}</dt>
                      <dd>{copy.statusLabel(selected.status)}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>{copy.cv}</dt>
                      <dd>
                        {selected.cvFileName} ·{" "}
                        {formatBytes(selected.cvByteSize)}
                      </dd>
                    </div>
                    {selected.invitationEmailStatus ? (
                      <div className={styles.detailItem}>
                        <dt>{copy.invitationEmail}</dt>
                        <dd>
                          {selected.invitationEmailStatus === "DEAD"
                            ? copy.deliveryFailed
                            : copy.emailStatusLabel(
                                selected.invitationEmailStatus,
                              )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {selected.rejectionReason ? (
                    <p className={styles.detailMeta}>
                      {copy.rejectionReason(selected.rejectionReason)}
                    </p>
                  ) : null}
                  <div className={styles.detailActions}>
                    <a
                      className={styles.link}
                      href={`/api/recruiter/company/team/applications/${encodeURIComponent(selected.applicationId)}/cv`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {copy.viewCv}
                    </a>
                    {selected.invitationStatus === "PENDING" &&
                    selected.invitationExpiresAt ? (
                      <span className={styles.detailMeta}>
                        {copy.invitationExpires(
                          formatCompanyTeamApplicationDate(
                            selected.invitationExpiresAt,
                            locale,
                          ),
                        )}
                      </span>
                    ) : null}
                  </div>
                  {selected.invitationEmailStatus === "DEAD" ? (
                    <p className={styles.error} role="alert">
                      {copy.deliveryFailedDescription}
                    </p>
                  ) : null}
                  {reviewable || retryable ? (
                    <div className={styles.decisionForm}>
                      <label className={styles.field}>
                        {copy.invitationRole}
                        <select
                          className={styles.roleSelect}
                          value={role}
                          onChange={(event) =>
                            setRole(event.target.value as TeamRole)
                          }
                          disabled={busy || retryable}
                        >
                          <option value="HR_MANAGER">
                            {copy.roleLabel("HR_MANAGER")}
                          </option>
                          <option value="RECRUITER">
                            {copy.roleLabel("RECRUITER")}
                          </option>
                        </select>
                      </label>
                      {reviewable ? (
                        <label className={styles.field}>
                          {copy.optionalRejectionReason}
                          <textarea
                            className={styles.reason}
                            value={reason}
                            maxLength={2000}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={copy.rejectionPlaceholder}
                          />
                        </label>
                      ) : null}
                      <div className={styles.detailActions}>
                        <button
                          className={styles.button}
                          type="button"
                          disabled={busy}
                          onClick={() => requestDecision("accept")}
                        >
                          {busy
                            ? copy.working
                            : retryable
                              ? copy.retryInvitationEmail
                              : copy.acceptAndInvite}
                        </button>
                        {reviewable ? (
                          <button
                            className={`${styles.button} ${styles.danger}`}
                            type="button"
                            disabled={busy}
                            onClick={() => requestDecision("reject")}
                          >
                            {copy.rejectApplication}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                <strong>{copy.selectApplication}</strong>
                <p>{copy.chooseCandidate}</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className={styles.empty} role="status">
          <strong>{copy.noApplications}</strong>
          <p>{copy.noApplicationsDescription}</p>
        </div>
      )}
      {pendingDecision && selected ? (
        <div className={styles.dialogBackdrop}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-application-decision-title"
          >
            <h2 id="team-application-decision-title">
              {copy.confirmDecisionTitle}
            </h2>
            <p>
              {pendingDecision === "accept"
                ? copy.confirmAccept(
                    copy.roleLabel(role),
                    selected.candidateName,
                  )
                : copy.confirmReject(selected.candidateName)}
            </p>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.button} ${styles.secondary}`}
                type="button"
                disabled={busy}
                onClick={() => setPendingDecision(null)}
              >
                {copy.cancelDecision}
              </button>
              <button
                className={`${styles.button} ${pendingDecision === "reject" ? styles.danger : ""}`}
                type="button"
                disabled={busy}
                onClick={() => void decide(pendingDecision)}
              >
                {busy
                  ? copy.working
                  : pendingDecision === "accept"
                    ? copy.confirmAcceptAction
                    : copy.confirmRejectAction}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
