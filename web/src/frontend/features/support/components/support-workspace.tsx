"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { WorkspacePageHeader } from "@/frontend/features/dashboard/components/page-header";
import type {
  SupportCaseDetail,
  SupportCaseSummary,
  SupportCategory,
} from "@/shared/contracts/support";
import { useSupportInvalidation } from "../client/use-support-invalidation";
import { handleSupportMessageKeyDown } from "./support-message-keyboard";

function supportCopy(locale: "vi" | "en") {
  return locale === "vi"
    ? {
        kicker: "HỖ TRỢ SMART HIRE",
        title: "Trung tâm hỗ trợ",
        description:
          "Trao đổi riêng tư với đội ngũ hỗ trợ. Nhân viên hỗ trợ không thể đọc các cuộc trò chuyện thông thường của bạn.",
        connected: "Đang kết nối trực tuyến",
        connecting: "Đang kết nối",
        offline: "Ngoại tuyến",
        supportCases: "Yêu cầu hỗ trợ",
        conversationMessages: "Tin nhắn hỗ trợ",
        newCase: "Tạo yêu cầu hỗ trợ",
        category: "Danh mục",
        subject: "Tiêu đề",
        help: "Chúng tôi có thể giúp gì?",
        submitting: "Đang gửi…",
        create: "Tạo yêu cầu",
        disabledHint: "Điền đầy đủ Tiêu đề và Nội dung để gửi yêu cầu",
        yourCases: "Yêu cầu của bạn",
        noCases: "Chưa có yêu cầu hỗ trợ.",
        selectCase: "Chọn một yêu cầu",
        selectCaseCopy: "Chọn yêu cầu đã có hoặc tạo yêu cầu mới ở bên trái.",
        faqLink: "Trong khi chờ — xem Câu hỏi thường gặp →",
        recoveryLink: "Hướng dẫn khôi phục tài khoản →",
        online: "Trực tuyến",
        you: "Bạn",
        deletedContent:
          "Nội dung tin nhắn đã được xoá theo chính sách lưu trữ.",
        reply: "Trả lời đội ngũ hỗ trợ SmartHire",
        sendHint: "Enter để gửi; Shift + Enter để xuống dòng",
        sending: "Đang gửi…",
        reopen: "Trả lời và mở lại",
        send: "Gửi phản hồi",
        closed:
          "Yêu cầu này đã đóng. Hãy tạo yêu cầu mới nếu bạn cần thêm hỗ trợ.",
        createError: "Không thể tạo yêu cầu hỗ trợ.",
        sendError: "Không thể gửi tin nhắn.",
        requestError: "Không thể tải yêu cầu hỗ trợ.",
        states: {
          OPEN: "Đang mở",
          WAITING_FOR_USER: "Chờ bạn phản hồi",
          WAITING_FOR_SUPPORT: "Đang được hỗ trợ",
          RESOLVED: "Đã xử lý",
          CLOSED: "Đã đóng",
        },
        categories: {
          ACCOUNT_ACCESS: "Truy cập tài khoản",
          PROFILE: "Hồ sơ",
          JOBS_APPLICATIONS: "Việc làm và ứng tuyển",
          RECRUITER: "Dịch vụ nhà tuyển dụng",
          MESSAGING: "Tin nhắn",
          PRIVACY_SAFETY: "Quyền riêng tư và an toàn",
          OTHER: "Khác",
        },
        locale: "vi-VN",
      }
    : {
        kicker: "SMART HIRE SUPPORT",
        title: "Support Center",
        description:
          "Talk privately with the platform support team. Support agents cannot read your ordinary conversations.",
        connected: "Realtime connected",
        connecting: "Connecting",
        offline: "Offline",
        supportCases: "Support cases",
        conversationMessages: "Support conversation messages",
        newCase: "Start a support case",
        category: "Category",
        subject: "Subject",
        help: "How can we help?",
        submitting: "Submitting…",
        create: "Create case",
        disabledHint: "Fill in Subject and Description to submit",
        yourCases: "Your cases",
        noCases: "No support cases yet.",
        selectCase: "Select a case",
        selectCaseCopy:
          "Choose an existing case or start a new one on the left.",
        faqLink: "While you wait — check the FAQ →",
        recoveryLink: "Account recovery guide →",
        online: "Online",
        you: "You",
        deletedContent:
          "Message content was deleted under the retention policy.",
        reply: "Reply to SmartHire Support",
        sendHint: "Enter to send; Shift+Enter for a new line",
        sending: "Sending…",
        reopen: "Reply and reopen",
        send: "Send reply",
        closed: "This case is closed. Create a new case if you need more help.",
        createError: "Unable to create case.",
        sendError: "Unable to send message.",
        requestError: "Unable to load support case.",
        states: {
          OPEN: "Open",
          WAITING_FOR_USER: "Waiting for you",
          WAITING_FOR_SUPPORT: "In progress",
          RESOLVED: "Resolved",
          CLOSED: "Closed",
        },
        categories: {
          ACCOUNT_ACCESS: "Account access",
          PROFILE: "Profile",
          JOBS_APPLICATIONS: "Jobs and applications",
          RECRUITER: "Recruiter services",
          MESSAGING: "Messaging",
          PRIVACY_SAFETY: "Privacy and safety",
          OTHER: "Other",
        },
        locale: "en-US",
      };
}

async function supportApi(
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
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error?.message ?? "SUPPORT_REQUEST_FAILED");
  return body;
}

export function SupportWorkspace({
  csrfProof,
  initialCases,
}: {
  csrfProof: string;
  initialCases: SupportCaseSummary[];
}) {
  const locale = useWorkspaceLocale();
  const copy = supportCopy(locale);
  const categories = Object.entries(copy.categories) as Array<
    [SupportCategory, string]
  >;
  const [cases, setCases] = useState(initialCases);
  const [selectedId, setSelectedId] = useState(initialCases[0]?.id ?? null);
  const [detail, setDetail] = useState<SupportCaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<SupportCategory>("ACCOUNT_ACCESS");
  const [subject, setSubject] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [reply, setReply] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const canCreateCase =
    !busy && subject.trim().length >= 5 && Boolean(initialMessage.trim());
  const refreshCases = useCallback(async () => {
    const body = await supportApi("/api/support/cases", csrfProof);
    setCases(body.data);
  }, [csrfProof]);
  const refreshDetail = useCallback(
    async (caseId: string) => {
      const body = await supportApi(
        `/api/support/cases/${encodeURIComponent(caseId)}`,
        csrfProof,
      );
      setDetail(body.data);
    },
    [csrfProof],
  );
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const loadDetail = window.setTimeout(() => {
      void refreshDetail(selectedId).catch((reason) => {
        if (active)
          setError(
            reason instanceof Error &&
              reason.message !== "SUPPORT_REQUEST_FAILED"
              ? reason.message
              : copy.requestError,
          );
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(loadDetail);
    };
  }, [copy.requestError, refreshDetail, selectedId]);
  const connection = useSupportInvalidation(
    useCallback(
      (event) => {
        void refreshCases();
        if (event.caseId === selectedId) void refreshDetail(event.caseId);
      },
      [refreshCases, refreshDetail, selectedId],
    ),
  );
  const connectionStatus =
    connection === "CONNECTED"
      ? { label: copy.connected, state: "connected" as const }
      : connection === "CONNECTING"
        ? { label: copy.connecting, state: "connecting" as const }
        : { label: copy.offline, state: "offline" as const };
  useEffect(() => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [detail?.id, detail?.messages.length]);
  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = await supportApi("/api/support/cases", csrfProof, {
        method: "POST",
        body: JSON.stringify({
          category,
          subject,
          message: initialMessage,
          clientOperationId: crypto.randomUUID(),
        }),
      });
      setSubject("");
      setInitialMessage("");
      setDetail(body.data);
      setSelectedId(body.data.id);
      await refreshCases();
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message !== "SUPPORT_REQUEST_FAILED"
          ? reason.message
          : copy.createError,
      );
    } finally {
      setBusy(false);
    }
  }
  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const body = await supportApi(
        `/api/support/cases/${encodeURIComponent(detail.id)}/messages`,
        csrfProof,
        {
          method: "POST",
          body: JSON.stringify({
            content: reply,
            clientOperationId: crypto.randomUUID(),
            expectedVersion: detail.version,
          }),
        },
      );
      setReply("");
      setDetail(body.data);
      await refreshCases();
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message !== "SUPPORT_REQUEST_FAILED"
          ? reason.message
          : copy.sendError,
      );
      await refreshDetail(detail.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="support-workspace">
      <WorkspacePageHeader
        eyebrow={copy.kicker}
        title={copy.title}
        subtitle={copy.description}
        statusBadge={connectionStatus}
      />
      {error ? (
        <div className="support-alert" role="alert">
          {error}
        </div>
      ) : null}
      <section className="support-layout">
        <aside className="support-sidebar" aria-label={copy.supportCases}>
          <form className="support-new-case" onSubmit={createCase}>
            <h2>{copy.newCase}</h2>
            <label>
              {copy.category}
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as SupportCategory)
                }
              >
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.subject}
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={5}
                maxLength={120}
                required
              />
            </label>
            <label>
              {copy.help}
              <textarea
                value={initialMessage}
                onChange={(event) => setInitialMessage(event.target.value)}
                maxLength={4000}
                required
              />
            </label>
            <button type="submit" disabled={!canCreateCase}>
              {busy ? copy.submitting : copy.create}
            </button>
            {!canCreateCase && !busy ? (
              <p className="support-form-hint">{copy.disabledHint}</p>
            ) : null}
          </form>
          <div className="support-case-list">
            <h2>{copy.yourCases}</h2>
            {cases.length === 0 ? (
              <div className="support-case-empty-row">
                <span aria-hidden="true">
                  <CaseIcon />
                </span>
                <p>{copy.noCases}</p>
              </div>
            ) : (
              cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedId === item.id ? "selected" : undefined}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.subject}</strong>
                  <span>
                    {copy.categories[item.category] ??
                      item.category.replaceAll("_", " ")}
                  </span>
                  <small>{copy.states[item.state]}</small>
                  <time dateTime={item.updatedAt}>
                    {new Date(item.updatedAt).toLocaleDateString(copy.locale)}
                  </time>
                </button>
              ))
            )}
          </div>
        </aside>
        <section
          className="support-thread"
          data-empty={!detail}
          aria-live="polite"
        >
          {!detail ? (
            <div className="support-empty">
              <span className="support-empty__icon" aria-hidden="true">
                <SupportGuideIcon />
              </span>
              <h2>{copy.selectCase}</h2>
              <p>{copy.selectCaseCopy}</p>
              <nav className="support-empty__links" aria-label={copy.title}>
                <Link href="/support/faq">{copy.faqLink}</Link>
                <Link href="/support/account-recovery">
                  {copy.recoveryLink}
                </Link>
              </nav>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <p>{detail.correspondent}</p>
                  <h2>{detail.subject}</h2>
                  <span className="support-online-status">
                    <span aria-hidden="true" /> {copy.online}
                  </span>
                </div>
                <span className="support-status">
                  {copy.states[detail.state]}
                </span>
              </header>
              <div
                ref={messagesRef}
                className="support-messages"
                aria-label={copy.conversationMessages}
              >
                {!detail.contentAvailable ? (
                  <p>{copy.deletedContent}</p>
                ) : (
                  detail.messages.map((message) => (
                    <article key={message.id} data-author={message.author}>
                      <strong>
                        {message.author === "YOU"
                          ? copy.you
                          : "SmartHire Support"}
                      </strong>
                      <p>{message.content}</p>
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleString(
                          copy.locale,
                        )}
                      </time>
                    </article>
                  ))
                )}
              </div>
              {detail.state !== "CLOSED" && detail.contentAvailable ? (
                <form className="support-reply" onSubmit={sendReply}>
                  <label htmlFor="support-reply">{copy.reply}</label>
                  <textarea
                    id="support-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) =>
                      handleSupportMessageKeyDown(event, () => {
                        if (!busy && reply.trim())
                          event.currentTarget.form?.requestSubmit();
                      })
                    }
                    maxLength={4000}
                    required
                  />
                  <small>{copy.sendHint}</small>
                  <button type="submit" disabled={busy || !reply.trim()}>
                    {busy
                      ? copy.sending
                      : detail.state === "RESOLVED"
                        ? copy.reopen
                        : copy.send}
                  </button>
                </form>
              ) : (
                <p className="support-closed">{copy.closed}</p>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function CaseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4m0 3h.01" />
    </svg>
  );
}

function SupportGuideIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5Z" />
      <path d="M8 8h1.5M14.5 8H16" />
    </svg>
  );
}
