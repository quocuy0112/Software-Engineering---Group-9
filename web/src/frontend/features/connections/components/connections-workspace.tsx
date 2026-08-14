"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { WorkspacePageHeader } from "@/frontend/features/dashboard/components/page-header";
import type {
  ConnectionNotificationProjection,
  ParticipantProposal,
  ProfessionalConnectionProjection,
} from "@/shared/contracts/connections";
import { useConnectionInvalidation } from "../client/use-connection-invalidation";

async function connectionApi(
  path: string,
  csrfProof: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET")
    headers.set("x-csrf-proof", csrfProof);
  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error?.message ?? "CONNECTION_REQUEST_FAILED");
  return body;
}

function connectionCopy(locale: "vi" | "en") {
  return locale === "vi"
    ? {
        kicker: "KẾT NỐI CÓ ĐỒNG THUẬN",
        title: "Kết nối chuyên nghiệp",
        description:
          "Xem xét từng đề xuất độc lập. Tin nhắn chỉ mở khi cả hai bên chấp nhận.",
        connected: "Đang kết nối trực tuyến",
        offline: "Ngoại tuyến",
        connecting: "Đang kết nối",
        flow: [
          {
            title: "Admin đề xuất",
            description: "Quản trị viên giới thiệu 2 tài khoản với nhau",
          },
          {
            title: "Cả 2 bên đồng ý",
            description: "Không bên nào bị kết nối khi chưa xác nhận",
          },
          {
            title: "Mở khoá nhắn tin",
            description: "Chỉ lúc này mới nhắn tin riêng được với nhau",
          },
        ],
        consent: "SỰ ĐỒNG THUẬN CỦA BẠN",
        proposals: "Đề xuất kết nối",
        pending: "đang chờ",
        noProposals: "Chưa có đề xuất",
        noProposalsCopy:
          "Quản trị viên có thể giới thiệu hai tài khoản, nhưng không thể tạo kết nối nếu thiếu sự chấp thuận của cả hai bên.",
        detailsRemoved: "Chi tiết đã được xoá",
        proposalNotRetained: "Nội dung đề xuất không còn được lưu.",
        status: "Trạng thái",
        expires: "Hết hạn",
        acceptedWaiting: "Đã chấp nhận — đang chờ",
        accept: "Chấp nhận",
        decline: "Từ chối",
        messagingAccess: "QUYỀN NHẮN TIN",
        connections: "Kết nối của bạn",
        active: "đang hoạt động",
        noConnections: "Chưa có kết nối",
        noConnectionsCopy:
          "Sau khi cả hai bên chấp nhận đề xuất, kết nối sẽ xuất hiện tại đây và có thể nhắn tin riêng tư.",
        messagingEnabled: "Đã bật nhắn tin",
        connectionEnded: "Kết nối đã kết thúc — lịch sử chỉ đọc",
        openMessages: "Mở tin nhắn",
        disconnect: "Ngắt kết nối",
        viewHistory: "Xem lịch sử",
        updates: "CẬP NHẬT",
        notifications: "Thông báo",
        unread: "chưa đọc",
        noUpdates:
          "Không có thông báo mới. Thay đổi về đề xuất và kết nối sẽ xuất hiện ở đây.",
        endConfirm: (name: string) =>
          `Kết thúc kết nối với ${name}? Lịch sử trò chuyện hiện có sẽ chuyển sang chỉ đọc.`,
        saveError: "Không thể lưu lựa chọn của bạn.",
        disconnectError: "Không thể kết thúc kết nối.",
        locale: "vi-VN",
      }
    : {
        kicker: "CONSENT-BASED NETWORK",
        title: "Professional Connections",
        description:
          "Review proposals independently. Messaging opens only after both people accept.",
        connected: "Realtime connected",
        offline: "Offline",
        connecting: "Connecting",
        flow: [
          {
            title: "Admin proposes",
            description:
              "A Platform Administrator introduces two accounts to each other",
          },
          {
            title: "Both people accept",
            description: "Neither side is connected until both confirm",
          },
          {
            title: "Messaging unlocked",
            description: "Only then can the two message each other privately",
          },
        ],
        consent: "YOUR CONSENT",
        proposals: "Connection proposals",
        pending: "pending",
        noProposals: "No proposals",
        noProposalsCopy:
          "A Platform Administrator may introduce two accounts, but cannot connect them without both approvals.",
        detailsRemoved: "Details removed",
        proposalNotRetained: "Proposal detail is no longer retained.",
        status: "Status",
        expires: "Expires",
        acceptedWaiting: "Accepted — waiting",
        accept: "Accept",
        decline: "Decline",
        messagingAccess: "MESSAGING ACCESS",
        connections: "Your connections",
        active: "active",
        noConnections: "No connections yet",
        noConnectionsCopy:
          "After both people accept a proposal, the connection appears here and becomes eligible for private messaging.",
        messagingEnabled: "Messaging enabled",
        connectionEnded: "Connection ended — history remains read-only",
        openMessages: "Open messages",
        disconnect: "Disconnect",
        viewHistory: "View history",
        updates: "UPDATES",
        notifications: "Notifications",
        unread: "unread",
        noUpdates:
          "No updates. Proposal and connection changes will appear here.",
        endConfirm: (name: string) =>
          `End your connection with ${name}? Existing chat history becomes read-only.`,
        saveError: "Unable to save your decision.",
        disconnectError: "Unable to end this connection.",
        locale: "en-US",
      };
}

function proposalStateLabel(
  state: ParticipantProposal["state"],
  locale: "vi" | "en",
) {
  const labels =
    locale === "vi"
      ? {
          PENDING_BOTH: "Đang chờ cả hai bên",
          PARTIALLY_ACCEPTED: "Đang chờ phản hồi",
          ACCEPTED: "Đã chấp nhận",
          DECLINED: "Đã từ chối",
          EXPIRED: "Đã hết hạn",
          CANCELLED: "Đã huỷ",
        }
      : {
          PENDING_BOTH: "Waiting for both people",
          PARTIALLY_ACCEPTED: "Waiting for a response",
          ACCEPTED: "Accepted",
          DECLINED: "Declined",
          EXPIRED: "Expired",
          CANCELLED: "Cancelled",
        };
  return labels[state] ?? state.replaceAll("_", " ");
}

export function ConnectionsWorkspace({
  csrfProof,
  initialProposals,
  initialConnections,
  initialNotifications,
}: {
  csrfProof: string;
  initialProposals: ParticipantProposal[];
  initialConnections: ProfessionalConnectionProjection[];
  initialNotifications: ConnectionNotificationProjection[];
}) {
  const locale = useWorkspaceLocale();
  const copy = connectionCopy(locale);
  const [proposals, setProposals] = useState(initialProposals);
  const [connections, setConnections] = useState(initialConnections);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const [proposalBody, connectionBody, notificationBody] = await Promise.all([
      connectionApi("/api/connections/proposals?limit=50", csrfProof),
      connectionApi("/api/connections?limit=50", csrfProof),
      connectionApi("/api/connections/notifications?limit=50", csrfProof),
    ]);
    setProposals(proposalBody.items);
    setConnections(connectionBody.items);
    setNotifications(notificationBody.items);
  }, [csrfProof]);
  const realtime = useConnectionInvalidation(
    useCallback(() => void refresh(), [refresh]),
  );
  const activeProposals = proposals.filter((item) =>
    ["PENDING_BOTH", "PARTIALLY_ACCEPTED"].includes(item.state),
  );
  async function decide(
    proposal: ParticipantProposal,
    decision: "ACCEPTED" | "DECLINED",
  ) {
    setBusyId(proposal.id);
    setError(null);
    try {
      await connectionApi(
        `/api/connections/proposals/${encodeURIComponent(proposal.id)}/decision`,
        csrfProof,
        {
          method: "POST",
          headers: {
            "if-match-version": String(proposal.version),
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ decision }),
        },
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error &&
          reason.message !== "CONNECTION_REQUEST_FAILED"
          ? reason.message
          : copy.saveError,
      );
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }
  async function disconnect(connection: ProfessionalConnectionProjection) {
    if (
      !window.confirm(copy.endConfirm(connection.otherParticipant.displayName))
    )
      return;
    setBusyId(connection.id);
    setError(null);
    try {
      await connectionApi(
        `/api/connections/${encodeURIComponent(connection.id)}/disconnect`,
        csrfProof,
        {
          method: "POST",
          headers: {
            "if-match-version": String(connection.version),
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ confirmation: true }),
        },
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error &&
          reason.message !== "CONNECTION_REQUEST_FAILED"
          ? reason.message
          : copy.disconnectError,
      );
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }
  async function markRead(notification: ConnectionNotificationProjection) {
    if (notification.readAt) return;
    await connectionApi(
      `/api/connections/notifications/${encodeURIComponent(notification.id)}/read`,
      csrfProof,
      { method: "POST", headers: { "idempotency-key": crypto.randomUUID() } },
    );
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
  }
  const realtimeLabel =
    realtime === "CONNECTED"
      ? copy.connected
      : realtime === "OFFLINE"
        ? copy.offline
        : copy.connecting;
  return (
    <main className="connections-workspace">
      <WorkspacePageHeader
        eyebrow={copy.kicker}
        title={copy.title}
        subtitle={copy.description}
        statusBadge={{
          label: realtimeLabel,
          state: realtime.toLowerCase() as
            | "connected"
            | "connecting"
            | "reconnecting"
            | "offline",
        }}
      />
      {error ? (
        <p className="connections-alert" role="alert">
          {error}
        </p>
      ) : null}
      <section className="connections-flow" aria-label={copy.title}>
        {copy.flow.map((step, index) => (
          <div className="connections-flow__group" key={step.title}>
            <article className="connections-flow__step">
              <span
                className="connections-flow__icon"
                data-step={index + 1}
                aria-hidden="true"
              >
                <ConsentFlowIcon step={index + 1} />
              </span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
              </div>
            </article>
            {index < copy.flow.length - 1 ? (
              <span className="connections-flow__arrow" aria-hidden="true">
                <ArrowIcon />
              </span>
            ) : null}
          </div>
        ))}
      </section>
      <section className="connections-grid">
        <article className="connections-panel connections-panel--mini">
          <header>
            <div>
              <p>{copy.consent}</p>
              <h2>{copy.proposals}</h2>
            </div>
            <span>
              {activeProposals.length} {copy.pending}
            </span>
          </header>
          {proposals.length === 0 ? (
            <CompactEmpty
              title={copy.noProposals}
              description={copy.noProposalsCopy}
            />
          ) : (
            <div className="connection-card-list">
              {proposals.map((proposal) => {
                const active = ["PENDING_BOTH", "PARTIALLY_ACCEPTED"].includes(
                  proposal.state,
                );
                const name =
                  proposal.otherParticipant?.displayName ?? copy.detailsRemoved;
                return (
                  <section className="connection-card" key={proposal.id}>
                    <div className="connection-person">
                      <div className="connection-avatar" aria-hidden="true">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3>{name}</h3>
                        <p>{proposal.reason ?? copy.proposalNotRetained}</p>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>{copy.status}</dt>
                        <dd data-state={proposal.state.toLowerCase()}>
                          {proposalStateLabel(proposal.state, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt>{copy.expires}</dt>
                        <dd>
                          {new Date(proposal.expiresAt).toLocaleDateString(
                            copy.locale,
                          )}
                        </dd>
                      </div>
                    </dl>
                    {active ? (
                      <div className="connection-actions">
                        <button
                          type="button"
                          className="primary"
                          disabled={
                            busyId === proposal.id ||
                            proposal.myDecision === "ACCEPTED"
                          }
                          onClick={() => void decide(proposal, "ACCEPTED")}
                        >
                          {proposal.myDecision === "ACCEPTED"
                            ? copy.acceptedWaiting
                            : copy.accept}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busyId === proposal.id}
                          onClick={() => void decide(proposal, "DECLINED")}
                        >
                          {copy.decline}
                        </button>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </article>
        <article className="connections-panel connections-panel--mini">
          <header>
            <div>
              <p>{copy.messagingAccess}</p>
              <h2>{copy.connections}</h2>
            </div>
            <span>
              {connections.filter((item) => item.state === "ACCEPTED").length}{" "}
              {copy.active}
            </span>
          </header>
          {connections.length === 0 ? (
            <CompactEmpty
              title={copy.noConnections}
              description={copy.noConnectionsCopy}
            />
          ) : (
            <div className="connection-card-list">
              {connections.map((connection) => (
                <section
                  className="connection-card compact"
                  key={connection.id}
                >
                  <div className="connection-person">
                    <div className="connection-avatar" aria-hidden="true">
                      {connection.otherParticipant.displayName
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3>{connection.otherParticipant.displayName}</h3>
                      <p>
                        {connection.state === "ACCEPTED"
                          ? copy.messagingEnabled
                          : copy.connectionEnded}
                      </p>
                    </div>
                  </div>
                  <div className="connection-actions">
                    {connection.state === "ACCEPTED" ? (
                      <>
                        <Link className="primary link" href="/messages">
                          {copy.openMessages}
                        </Link>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyId === connection.id}
                          onClick={() => void disconnect(connection)}
                        >
                          {copy.disconnect}
                        </button>
                      </>
                    ) : (
                      <Link className="secondary link" href="/messages">
                        {copy.viewHistory}
                      </Link>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </article>
        <aside
          className="connections-notification-strip"
          data-populated={notifications.length > 0}
          aria-label={copy.notifications}
        >
          {notifications.length === 0 ? (
            <div className="connections-notification-strip__empty">
              <span aria-hidden="true">
                <NotificationIcon />
              </span>
              <p>{copy.noUpdates}</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  data-read={Boolean(notification.readAt)}
                  onClick={() => void markRead(notification)}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time dateTime={notification.createdAt}>
                    {new Date(notification.createdAt).toLocaleString(
                      copy.locale,
                    )}
                  </time>
                </button>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function CompactEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="connections-mini-empty">
      <span aria-hidden="true">
        <EmptyStateIcon />
      </span>
      <p>
        <strong>{title}.</strong> {description}
      </p>
    </div>
  );
}

function ConsentFlowIcon({ step }: { step: number }) {
  if (step === 1)
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" />
        <path d="M3.5 20.5a5.5 5.5 0 0 1 11 0M18 7v6m-3-3h6" />
      </svg>
    );
  if (step === 2)
    return (
      <svg viewBox="0 0 24 24">
        <path d="m5 12 4.2 4.2L19 6.5" />
        <path d="M21 12a9 9 0 1 1-3-6.7" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24">
      <path d="M19.5 11.5A4.5 4.5 0 0 1 15 16h-5l-4.5 3v-7.5A4.5 4.5 0 0 1 10 7h2" />
      <rect x="14" y="6.5" width="6" height="5.5" rx="1" />
      <path d="M15.5 6.5V5a1.5 1.5 0 0 1 3 0v1.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 12h15m-5-5 5 5-5 5" />
    </svg>
  );
}

function EmptyStateIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4m0 3h.01" />
    </svg>
  );
}

function NotificationIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}
