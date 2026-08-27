"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import styles from "./company-team-screen.module.css";
import {
  recruiterWorkspaceCopy,
  type RecruiterWorkspaceCopy,
} from "./recruiter-workspace-copy";

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
const roleLabel = (role: string, copy: RecruiterWorkspaceCopy) =>
  role === "HR_MANAGER"
    ? copy.role.hrManager
    : role === "RECRUITER"
      ? copy.role.recruiter
      : role === "HIRING_MANAGER"
        ? copy.role.hiringManager
        : copy.role.owner;
const statusLabel = (status: string, copy: RecruiterWorkspaceCopy) =>
  copy.team.statuses[status as keyof typeof copy.team.statuses] ?? status;
const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
const activityLabel = (kind: string, copy: RecruiterWorkspaceCopy) =>
  ({
    INVITED: copy.team.actions.invited,
    ACCEPTED: copy.team.actions.accepted,
    DECLINED: copy.team.actions.declined,
    REVOKED: copy.team.actions.revoked,
    ROLE_CHANGED: copy.team.actions.changedTheRoleOf,
    SUSPENDED: copy.team.actions.suspended,
    RESTORED: copy.team.actions.restored,
    REMOVED: copy.team.actions.removed,
  })[kind] ?? copy.team.activityUpdated;
const invitationErrorMessage = (
  code: string | undefined,
  copy: RecruiterWorkspaceCopy,
) => {
  switch (code) {
    case "INVITATION_EXISTS":
      return copy.team.invitationExists;
    case "MEMBERSHIP_EXISTS":
      return copy.team.membershipExists;
    case "RECIPIENT_UNAVAILABLE":
      return copy.team.recipientUnavailable;
    default:
      return copy.team.inviteFailed;
  }
};

export function CompanyTeamScreen({
  companyId,
  members,
  invitations,
  activities = [],
}: Props) {
  const locale = useWorkspaceLocale();
  const copy = recruiterWorkspaceCopy(locale);
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
      if (!response.ok)
        throw new Error(invitationErrorMessage(payload.code, copy));
      setEmail("");
      toast.success(copy.team.invitationQueued, {
        description: copy.team.invitationQueuedDescription,
      });
      router.refresh();
    } catch (error) {
      toast.error(copy.team.invitationNotSent, {
        description:
          error instanceof Error
            ? error.message
            : copy.team.inviteFailed,
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
      if (!response.ok) throw new Error(copy.team.updateFailed);
      setMessage(copy.team.memberUpdated);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : copy.team.updateFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (
      !window.confirm(
        copy.team.revokeConfirm,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/recruiter/company/team/invitations/${id}/revoke${companyQuery}`,
        { method: "POST", headers: { "x-csrf-token": csrf } },
      );
      if (!response.ok) throw new Error(copy.team.revokeFailed);
      setMessage(copy.team.invitationRevoked);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : copy.team.revokeFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{copy.teamSettings}</p>
          <h1>{copy.team.title}</h1>
          <p>{copy.team.description}</p>
        </div>
        <div className={styles.memberCount}>
          <strong>{members.length}</strong>
          <span>{copy.team.memberCount(members.length)}</span>
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
              <b>{copy.team.invite}</b>
            </h2>
            <p>{copy.team.inviteDescription}</p>
          </div>
        </div>
        <form className={styles.inviteForm} onSubmit={invite}>
          <label className={styles.field}>
            <span>{copy.team.workEmail}</span>
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
            <span>{locale === "vi" ? "Vai trò" : "Role"}</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="RECRUITER">{copy.role.recruiter}</option>
              <option value="HR_MANAGER">{copy.role.hrManager}</option>
            </select>
          </label>
          <button
            className={styles.primaryButton}
            disabled={busy}
            type="submit"
          >
            {busy ? copy.team.sending : copy.team.sendInvitation}
          </button>
        </form>
      </section>
      <section className={styles.section} aria-labelledby="members-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="members-title">
              <b>{copy.team.members}</b>
            </h2>
            <p>{copy.team.manageMembers}</p>
          </div>
          <span className={styles.totalColor}>{copy.team.total(members.length)}</span>
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
                  {roleLabel(member.role, copy)}
                </span>
                <span
                  className={`${styles.statusBadge} ${member.status === "ACTIVE" ? styles.active : member.status === "SUSPENDED" ? styles.suspended : styles.removed}`}
                >
                  {statusLabel(member.status, copy)}
                </span>
                {managed ? (
                  <div className={styles.actions}>
                    <button
                      className={styles.textButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() => void command(member.id, "role", nextRole)}
                    >
                      {copy.team.makeRole(roleLabel(nextRole, copy))}
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
                        ? copy.team.restore
                        : copy.team.suspend}
                    </button>
                    <button
                      className={styles.removeButton}
                      disabled={busy || member.status === "REMOVED"}
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            copy.team.removeConfirm(member.user.name),
                          )
                        )
                          void command(member.id, "remove");
                      }}
                    >
                      {copy.team.remove}
                    </button>
                  </div>
                ) : (
                  <span className={styles.ownerNote}>{copy.team.primaryOwner}</span>
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
              <b>{copy.team.pendingInvitations}</b>
            </h2>
            <p>{copy.team.pendingDescription}</p>
          </div>
          <span className={styles.pendingColor}>
            {copy.team.pendingCount(invitations.length)}
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
                    {copy.team.invitedAs(
                      roleLabel(invitation.role, copy),
                      new Date(invitation.expiresAt).toLocaleDateString(
                        locale === "vi" ? "vi-VN" : "en-US",
                      ),
                    )}
                  </span>
                </div>
                <button
                  className={styles.removeButton}
                  disabled={busy}
                  type="button"
                  onClick={() => void revoke(invitation.id)}
                >
                  {copy.team.revoke}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✦</span>
            <div>
              <strong>{copy.team.noPending}</strong>
              <p>{copy.team.noPendingDescription}</p>
            </div>
          </div>
        )}
      </section>
      <section className={styles.section} aria-labelledby="activity-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="activity-title">
              <b>{copy.team.activity}</b>
            </h2>
            <p>{copy.team.activityDescription}</p>
          </div>
          <span className={styles.recentColor}>
            {copy.team.recent(activities.length)}
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
                    {activity.actor?.name ?? copy.team.system}{" "}
                    {activityLabel(activity.kind, copy)} {activity.targetEmail}
                  </strong>
                  <span>
                    {activity.role
                      ? `${copy.team.roleChanged} ${roleLabel(activity.role, copy)} · `
                      : ""}
                    {new Date(activity.occurredAt).toLocaleString(
                      locale === "vi" ? "vi-VN" : "en-US",
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">&#9940;</span>
            <div>
              <strong>{copy.team.noActivity}</strong>
              <p>{copy.team.noActivityDescription}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
