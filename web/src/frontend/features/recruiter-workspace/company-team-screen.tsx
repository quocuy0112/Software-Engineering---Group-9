"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { formatCompanyTeamDate, getCompanyTeamCopy } from "./company-team-copy";
import styles from "./company-team-screen.module.css";

type Props = {
  companyId?: string;
  members: Array<{
    id: string;
    role: string;
    status: string;
    user: { name: string; email: string };
  }>;
  invitations: Array<{
    id: string;
    normalizedEmail: string;
    role: string;
    expiresAt: Date;
  }>;
  activities?: Array<{
    id: string;
    kind: string;
    targetEmail: string;
    role: string | null;
    occurredAt: Date;
    actor: { name: string; email: string } | null;
  }>;
};
const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

export function CompanyTeamScreen({
  companyId,
  members,
  invitations,
  activities = [],
}: Props) {
  const locale = useWorkspaceLocale();
  const copy = getCompanyTeamCopy(locale);
  const csrf = useCsrfProof();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("RECRUITER");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const companyQuery = companyId
    ? `?companyId=${encodeURIComponent(companyId)}`
    : "";

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/recruiter/company/team/invitations${companyQuery}`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ email, role }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(copy.invitationError(payload.code));
      setEmail("");
      toast.success(copy.invitationQueued, {
        description: copy.invitationQueuedDescription,
      });
      router.refresh();
    } catch (error) {
      toast.error(copy.invitationNotSent, {
        description:
          error instanceof Error ? error.message : copy.sendInvitationError,
      });
    } finally {
      setBusy(false);
    }
  }

  async function command(id: string, action: string, nextRole?: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/recruiter/company/team/memberships/${id}${companyQuery}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({
            action,
            ...(nextRole ? { role: nextRole } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error(copy.updateMemberError);
      setMessage(copy.memberUpdated);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : copy.updateMemberError,
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm(copy.revokeConfirm)) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/recruiter/company/team/invitations/${id}/revoke${companyQuery}`,
        { method: "POST", headers: { "x-csrf-token": csrf } },
      );
      if (!response.ok) throw new Error(copy.revokeInvitationError);
      setMessage(copy.invitationRevoked);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : copy.revokeInvitationError,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{copy.breadcrumb}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className={styles.headerActions}>
          <Link
            className={styles.secondaryButton}
            href={`/recruiter/company-settings/team/applications${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`}
          >
            {copy.teamApplications}
          </Link>
          <div className={styles.memberCount}>
            <strong>{members.length}</strong>
            <span>{copy.teamMembers(members.length)}</span>
          </div>
        </div>
      </header>
      <p className={styles.notice} role="status" aria-live="polite">
        {message}
      </p>
      <section className={styles.inviteCard} aria-labelledby="invite-title">
        <div className={styles.cardTitle}>
          <span className={styles.icon} aria-hidden="true">
            👤
          </span>
          <div>
            <h2 id="invite-title">
              <b>{copy.inviteTeammate}</b>
            </h2>
            <p>{copy.inviteRequirement}</p>
          </div>
        </div>
        <form className={styles.inviteForm} onSubmit={invite}>
          <label className={styles.field}>
            <span>{copy.workEmail}</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
              type="email"
              autoComplete="email"
            />
          </label>
          <label className={styles.field}>
            <span>{copy.role}</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="RECRUITER">{copy.roleLabel("RECRUITER")}</option>
              <option value="HR_MANAGER">{copy.roleLabel("HR_MANAGER")}</option>
            </select>
          </label>
          <button
            className={styles.primaryButton}
            disabled={busy}
            type="submit"
          >
            {busy ? copy.sending : copy.sendInvitation}
          </button>
        </form>
      </section>
      <section className={styles.section} aria-labelledby="members-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="members-title">
              <b>{copy.membersTitle}</b>
            </h2>
            <p>{copy.membersDescription}</p>
          </div>
          <span className={styles.totalColor}>
            {copy.total(members.length)}
          </span>
        </div>
        <div className={styles.memberList}>
          {members.map((member) => {
            const managed = member.role !== "OWNER";
            const nextRole =
              member.role === "RECRUITER" ? "HR_MANAGER" : "RECRUITER";
            return (
              <article className={styles.memberRow} key={member.id}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(member.user.name)}
                </span>
                <div className={styles.memberIdentity}>
                  <strong>{member.user.name}</strong>
                  <span>{member.user.email}</span>
                </div>
                <span className={styles.roleBadge}>
                  {copy.roleLabel(member.role)}
                </span>
                <span
                  className={`${styles.statusBadge} ${member.status === "ACTIVE" ? styles.active : member.status === "SUSPENDED" ? styles.suspended : styles.removed}`}
                >
                  {copy.statusLabel(member.status)}
                </span>
                {managed ? (
                  <div className={styles.actions}>
                    <button
                      className={styles.textButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() => void command(member.id, "role", nextRole)}
                    >
                      {copy.makeRole(copy.roleLabel(nextRole))}
                    </button>
                    <button
                      className={styles.textButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() =>
                        void command(
                          member.id,
                          member.status === "SUSPENDED" ? "restore" : "suspend",
                        )
                      }
                    >
                      {member.status === "SUSPENDED"
                        ? copy.restore
                        : copy.suspend}
                    </button>
                    <button
                      className={styles.removeButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(copy.removeConfirm(member.user.name))
                        )
                          void command(member.id, "remove");
                      }}
                    >
                      {copy.remove}
                    </button>
                  </div>
                ) : (
                  <span className={styles.ownerNote}>{copy.primaryOwner}</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section
        className={styles.section}
        aria-labelledby="pending-invitations-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="pending-invitations-title">
              <b>{copy.pendingInvitations}</b>
            </h2>
            <p>{copy.pendingDescription}</p>
          </div>
          <span className={styles.pendingColor}>
            {copy.pendingCount(invitations.length)}
          </span>
        </div>
        {invitations.length ? (
          <div className={styles.invitationList}>
            {invitations.map((invitation) => (
              <article className={styles.invitationRow} key={invitation.id}>
                <span className={styles.pendingAvatar} aria-hidden="true">
                  ✉
                </span>
                <div>
                  <strong>{invitation.normalizedEmail}</strong>
                  <span>
                    {copy.invitedAs(
                      copy.roleLabel(invitation.role),
                      formatCompanyTeamDate(invitation.expiresAt, locale),
                    )}
                  </span>
                </div>
                <button
                  className={styles.removeButton}
                  disabled={busy}
                  type="button"
                  onClick={() => void revoke(invitation.id)}
                >
                  {copy.revoke}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <div>
              <strong>{copy.noPendingInvitations}</strong>
              <p>{copy.noPendingDescription}</p>
            </div>
          </div>
        )}
      </section>
      <section className={styles.section} aria-labelledby="activity-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="activity-title">
              <b>{copy.teamActivity}</b>
            </h2>
            <p>{copy.activityDescription}</p>
          </div>
          <span className={styles.recentColor}>
            {copy.recent(activities.length)}
          </span>
        </div>
        {activities.length ? (
          <ol className={styles.invitationList}>
            {activities.map((activity) => (
              <li className={styles.invitationRow} key={activity.id}>
                <span className={styles.pendingAvatar} aria-hidden="true">
                  &#33;
                </span>
                <div>
                  <strong>
                    {copy.activityEntry(
                      activity.actor?.name ?? copy.system,
                      copy.activityLabel(activity.kind),
                      activity.targetEmail,
                    )}
                  </strong>
                  <span>
                    {activity.role
                      ? `${copy.activityRole(copy.roleLabel(activity.role))} · `
                      : ""}
                    {formatCompanyTeamDate(activity.occurredAt, locale, true)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">&#9940;</span>
            <div>
              <strong>{copy.noActivity}</strong>
              <p>{copy.noActivityDescription}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
