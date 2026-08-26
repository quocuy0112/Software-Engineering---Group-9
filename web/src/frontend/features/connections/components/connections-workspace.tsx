"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  CircleHelp,
  ArrowUpRight,
  History,
  Search,
  ShieldCheck,
  UsersRound,
  UserRoundPlus,
} from "lucide-react";
import { Badge } from "@/frontend/components/ui/badge";
import { Panel } from "@/frontend/components/ui/design-system";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { WorkspacePageHeader } from "@/frontend/features/dashboard/components/page-header";
import type {
  ConnectionNotificationProjection,
  ParticipantProposal,
  ProfessionalConnectionProjection,
} from "@/shared/contracts/connections";
import type { DiscoverableProfile } from "@/shared/contracts/profile-discovery";
import { useConnectionInvalidation } from "../client/use-connection-invalidation";

type RecentProfileSearch = {
  userId: string;
  displayName: string;
};

const RECENT_PROFILE_SEARCHES_KEY = "smarthire:recent-profile-searches";
const MAX_RECENT_PROFILE_SEARCHES = 6;

function formatConnectionDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatConnectionDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

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
        locale: "en-GB",
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
  currentUserId = "",
}: {
  csrfProof: string;
  initialProposals: ParticipantProposal[];
  initialConnections: ProfessionalConnectionProjection[];
  initialNotifications: ConnectionNotificationProjection[];
  currentUserId?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = connectionCopy(locale);
  const [proposals, setProposals] = useState(initialProposals);
  const [connections, setConnections] = useState(initialConnections);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<DiscoverableProfile | null>(
    null,
  );
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentProfileSearch[]>(
    [],
  );

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(
        window.localStorage.getItem(RECENT_PROFILE_SEARCHES_KEY) ?? "[]",
      );
      if (!Array.isArray(parsed)) return;
      setRecentSearches(
        parsed
          .filter(
            (item): item is RecentProfileSearch =>
              typeof item === "object" &&
              item !== null &&
              typeof item.userId === "string" &&
              typeof item.displayName === "string",
          )
          .slice(0, MAX_RECENT_PROFILE_SEARCHES),
      );
    } catch {
      // History is a local convenience; unavailable browser storage is safe to ignore.
    }
  }, []);

  function rememberProfile(result: DiscoverableProfile) {
    const entry = { userId: result.userId, displayName: result.displayName };
    setRecentSearches((current) => {
      const next = [
        entry,
        ...current.filter((item) => item.userId !== entry.userId),
      ].slice(0, MAX_RECENT_PROFILE_SEARCHES);
      try {
        window.localStorage.setItem(
          RECENT_PROFILE_SEARCHES_KEY,
          JSON.stringify(next),
        );
      } catch {
        // Do not let unavailable local storage block a lookup.
      }
      return next;
    });
  }
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
  async function findProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = lookupId.trim();
    setLookupResult(null);
    setLookupMessage(null);
    if (!target) return;
    if (target === currentUserId) {
      setLookupMessage(
        "This is your account ID. Manage your profile from Profile settings.",
      );
      return;
    }
    setLookupBusy(true);
    try {
      const response = await fetch(
        `/api/people/lookup?userId=${encodeURIComponent(target)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLookupMessage(body.message ?? "Unable to complete this search.");
        return;
      }
      const result = body.result ?? null;
      setLookupResult(result);
      if (result) rememberProfile(result);
      else setLookupMessage("No visible profile found.");
    } catch {
      setLookupMessage("Unable to complete this search.");
    } finally {
      setLookupBusy(false);
    }
  }
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
      <section
        className="connections-profile-lookup"
        aria-labelledby="profile-lookup-title"
      >
        <div className="connections-profile-lookup__heading">
          <span className="connections-profile-lookup__icon">
            <Search aria-hidden="true" />
          </span>
          <div>
            <p className="connections-profile-lookup__eyebrow">
              PROFILE DISCOVERY
            </p>
            <h2 id="profile-lookup-title">Find a professional by ID</h2>
            <p>Only profiles that allow exact-ID discovery appear here.</p>
          </div>
        </div>
        <form
          onSubmit={findProfile}
          className="connections-profile-lookup__form"
        >
          <label htmlFor="candidate-profile-id">Candidate ID</label>
          <div>
            <input
              id="candidate-profile-id"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              autoComplete="off"
              maxLength={128}
              required
            />
            <button type="submit" className="primary" disabled={lookupBusy}>
              {lookupBusy ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
        {lookupMessage ? <p role="status">{lookupMessage}</p> : null}
        {lookupResult ? (
          <article className="connections-profile-result">
            <div className="connection-avatar" aria-hidden="true">
              {lookupResult.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h3>{lookupResult.displayName}</h3>
              {lookupResult.sections.headline ? (
                <p>{lookupResult.sections.headline}</p>
              ) : null}
              {lookupResult.sections.location ? (
                <p>{lookupResult.sections.location}</p>
              ) : null}
              {lookupResult.sections.skills?.length ? (
                <p>{lookupResult.sections.skills.join(" · ")}</p>
              ) : null}
            </div>
            <Link
              className="connections-profile-result__action"
              href={`/people/${encodeURIComponent(lookupResult.userId)}`}
              aria-label={`View ${lookupResult.displayName}'s profile`}
            >
              <span>View profile</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </article>
        ) : null}
      </section>
      {error ? (
        <p className="connections-alert" role="alert">
          {error}
        </p>
      ) : null}
      <section className="connections-summary" aria-label="Connection overview">
        <article>
          <span>
            <UsersRound aria-hidden="true" />
          </span>
          <div>
            <strong>
              {connections.filter((item) => item.state === "ACCEPTED").length}
            </strong>
            <small>Active connections</small>
          </div>
        </article>
        <article>
          <span>
            <UserRoundPlus aria-hidden="true" />
          </span>
          <div>
            <strong>{activeProposals.length}</strong>
            <small>Awaiting your response</small>
          </div>
        </article>
        <article>
          <span>
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <strong>Private by design</strong>
            <small>Messaging opens only with consent</small>
          </div>
        </article>
      </section>
      <section className="connections-grid">
        <Panel
          as="article"
          className="connections-panel connections-panel--mini"
          eyebrow={copy.consent}
          title={copy.proposals}
          rightSlot={
            <span className="count-pill connections-count connections-count--pending">
              {activeProposals.length} {copy.pending}
            </span>
          }
        >
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
                          {formatConnectionDate(
                            proposal.expiresAt,
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
        </Panel>
        <Panel
          as="article"
          className="connections-panel connections-panel--mini"
          eyebrow="PROFILE DISCOVERY"
          title="Recent profile searches"
          rightSlot={
            <span className="count-pill connections-count connections-count--saved">
              {recentSearches.length} saved
            </span>
          }
        >
          {recentSearches.length === 0 ? (
            <CompactEmpty
              title="No recent searches"
              description="Profiles you find by exact candidate ID will appear here for quick access on this browser."
            />
          ) : (
            <div className="recent-profile-searches">
              {recentSearches.map((search) => (
                <Link
                  href={`/people/${encodeURIComponent(search.userId)}`}
                  key={search.userId}
                >
                  <span className="connection-avatar" aria-hidden="true">
                    {search.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>{search.displayName}</span>
                  <History aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </Panel>
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
                    {formatConnectionDateTime(
                      notification.createdAt,
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

function EmptyStateIcon() {
  return <CircleHelp aria-hidden="true" />;
}

function NotificationIcon() {
  return <Bell aria-hidden="true" />;
}
