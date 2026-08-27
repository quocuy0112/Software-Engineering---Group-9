"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal, UserRound } from "lucide-react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterWorkspaceCopy } from "@/frontend/features/recruiter-workspace/recruiter-workspace-copy";

type ThreadSummary = {
  id: string;
  applicationId: string;
  state: "OPEN" | "READ_ONLY";
  canSend: boolean;
  candidate: { id: string; name: string; image: string | null };
  job: { id: string; title: string; companyId: string; companyName: string };
  applicationStage: string;
  assignee: {
    id: string;
    userId: string;
    name: string;
    image: string | null;
    role: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount: number;
};
type Detail = {
  thread: ThreadSummary;
  access: "CANDIDATE" | "ASSIGNEE" | "HR_MANAGER" | "STAFF_OBSERVER" | "OWNER";
  messages: Array<{
    id: string;
    sequence: number;
    senderUserId: string;
    content: string;
    createdAt: string;
  }>;
};

function stageLabel(
  stage: string,
  labels: ReturnType<typeof recruiterWorkspaceCopy>["messages"]["stages"],
) {
  return labels[stage as keyof typeof labels] ?? stage;
}

function recruiterRoleLabel(
  role: string,
  copy: ReturnType<typeof recruiterWorkspaceCopy>,
) {
  if (role === "HR_MANAGER") return copy.role.hrManager;
  if (role === "HIRING_MANAGER") return copy.role.hiringManager;
  if (role === "OWNER") return copy.role.owner;
  return copy.role.recruiter;
}

async function responseJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const body = (await response.json().catch(() => ({}))) as T & {
    code?: string;
  };
  if (!response.ok) throw new Error(body.code ?? "REQUEST_FAILED");
  return body;
}

export function RecruitmentMessagingWorkspace({
  csrfProof,
  initialItems,
  initialThreadId = null,
  ownerOversight = false,
}: {
  csrfProof: string;
  initialItems: ThreadSummary[];
  initialThreadId?: string | null;
  ownerOversight?: boolean;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruiterWorkspaceCopy(locale);
  const messagesCopy = copy.messages;
  const [items, setItems] = useState(initialItems);
  const [assignment, setAssignment] = useState<"mine" | "unassigned" | "all">(
    ownerOversight ? "all" : "mine",
  );
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("all");
  const [jobPostingId, setJobPostingId] = useState("all");
  const [selectedId, setSelectedId] = useState(
    initialThreadId ?? initialItems[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<Detail | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignees, setAssignees] = useState<
    Array<{ id: string; role: string; user: { name: string } }>
  >([]);
  const [assigneeId, setAssigneeId] = useState("");
  const initialListHydrated = useRef(false);
  const chatHistoryRef = useRef<HTMLDivElement | null>(null);
  const openedThreadRef = useRef<string | null>(null);
  const hasInitialItems = initialItems.length > 0;

  const companies = useMemo(
    () =>
      Array.from(
        new Map(
          items.map((item) => [item.job.companyId, item.job.companyName]),
        ).entries(),
      ).map(([id, name]) => ({ id, name })),
    [items],
  );
  const postings = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter(
              (item) => companyId === "all" || item.job.companyId === companyId,
            )
            .map((item) => [item.job.id, item.job.title]),
        ).entries(),
      ).map(([id, title]) => ({ id, title })),
    [companyId, items],
  );
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (companyId === "all" || item.job.companyId === companyId) &&
          (jobPostingId === "all" || item.job.id === jobPostingId) &&
          `${item.candidate.name} ${item.job.title} ${item.job.companyName}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [companyId, items, jobPostingId, query],
  );

  useEffect(() => {
    // The route already authorizes and renders the initial list on the
    // server. Avoid making the same query again during hydration; a later
    // assignment/filter change still refreshes the list as before.
    if (!initialListHydrated.current && hasInitialItems) {
      initialListHydrated.current = true;
      return;
    }
    initialListHydrated.current = true;
    void responseJson<{ items: ThreadSummary[] }>(
      ownerOversight
        ? "/api/recruiter/messages/oversight"
        : `/api/recruiter/messages?assignment=${assignment}`,
    )
      .then((payload) => {
        setItems(payload.items);
        setSelectedId((current) =>
          payload.items.some((item) => item.id === current)
            ? current
            : (payload.items[0]?.id ?? null),
        );
      })
      .catch(() => setError(messagesCopy.errors.loadConversations));
  }, [
    assignment,
    hasInitialItems,
    messagesCopy.errors.loadConversations,
    ownerOversight,
  ]);

  useEffect(() => {
    const refreshUnreadCounts = () =>
      void responseJson<{ items: ThreadSummary[] }>(
        ownerOversight
          ? "/api/recruiter/messages/oversight"
          : `/api/recruiter/messages?assignment=${assignment}`,
      )
        .then((payload) => setItems(payload.items))
        .catch(() => undefined);
    const timer = window.setInterval(refreshUnreadCounts, 10_000);
    return () => window.clearInterval(timer);
  }, [assignment, ownerOversight]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const refreshThread = (showError: boolean) =>
      responseJson<Detail>(
        ownerOversight
          ? `/api/recruiter/messages/oversight/threads/${encodeURIComponent(selectedId)}`
          : `/api/recruitment-threads/${encodeURIComponent(selectedId)}`,
      )
        .then((payload) => {
          if (!active) return;
          setDetail(payload);
          setError(null);
        })
        .catch(() => {
          if (!active || !showError) return;
          setDetail(null);
          setError(messagesCopy.errors.conversationUnavailable);
        });
    void refreshThread(true);
    const timer = window.setInterval(() => {
      void refreshThread(false);
    }, 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [messagesCopy.errors.conversationUnavailable, ownerOversight, selectedId]);

  useEffect(() => {
    if (!detail || detail.thread.id !== selectedId) return;
    const history = chatHistoryRef.current;
    if (!history) return;
    const openingThread = openedThreadRef.current !== detail.thread.id;
    const closeToBottom =
      history.scrollHeight - history.scrollTop - history.clientHeight < 48;
    if (!openingThread && !closeToBottom) return;
    const frame = window.requestAnimationFrame(() => {
      history.scrollTop = history.scrollHeight;
      openedThreadRef.current = detail.thread.id;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detail, selectedId]);

  const canAssign =
    detail?.access === "HR_MANAGER" || detail?.access === "OWNER";
  const assignmentThreadId = canAssign ? (detail?.thread.id ?? null) : null;
  const assignedMembershipId = canAssign
    ? (detail?.thread.assignee?.id ?? null)
    : null;

  useEffect(() => {
    if (!assignmentThreadId) return;
    void responseJson<{
      items: Array<{ id: string; role: string; user: { name: string } }>;
    }>(
      `/api/recruitment-threads/${encodeURIComponent(assignmentThreadId)}/assignees`,
    )
      .then((payload) => {
        setAssignees(payload.items);
        setAssigneeId(assignedMembershipId ?? payload.items[0]?.id ?? "");
      })
      .catch(() => setError(messagesCopy.errors.loadAssignees));
  }, [
    assignedMembershipId,
    assignmentThreadId,
    messagesCopy.errors.loadAssignees,
  ]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await responseJson(
        `/api/recruitment-threads/${encodeURIComponent(selectedId)}/messages`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfProof,
          },
          body: JSON.stringify({
            clientOperationId: crypto.randomUUID(),
            content,
          }),
        },
      );
      setContent("");
      const payload = await responseJson<Detail>(
        `/api/recruitment-threads/${encodeURIComponent(selectedId)}`,
      );
      setDetail(payload);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "READ_ONLY"
          ? messagesCopy.errors.readOnly
          : messagesCopy.errors.sendFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!detail || !assigneeId) return;
    setBusy(true);
    setError(null);
    try {
      await responseJson(
        `/api/recruiter/applications/${encodeURIComponent(detail.thread.applicationId)}/recruitment-thread/assignment`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfProof,
          },
          body: JSON.stringify({ membershipId: assigneeId }),
        },
      );
      const payload = await responseJson<Detail>(
        `/api/recruitment-threads/${encodeURIComponent(detail.thread.id)}`,
      );
      setDetail(payload);
    } catch {
      setError(messagesCopy.errors.assignmentFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="recruitment-messaging recruitment-messaging--recruiter"
      data-thread-open={Boolean(detail)}
    >
      <header className="recruitment-messaging__header">
        <p>
          {ownerOversight
            ? messagesCopy.ownerOversight
            : messagesCopy.recruiterWorkspace}
        </p>
        <h1>
          {ownerOversight ? messagesCopy.oversightTitle : messagesCopy.title}
        </h1>
        <span>{messagesCopy.description}</span>
      </header>
      {error ? (
        <p className="recruitment-messaging__error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="recruitment-messaging__grid">
        <aside
          className="recruitment-messaging__list"
          aria-label={messagesCopy.conversations}
        >
          <label>
            <span>{messagesCopy.searchCandidateOrJob}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messagesCopy.searchPlaceholder}
            />
          </label>
          <label>
            <span>{copy.company}</span>
            <select
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setJobPostingId("all");
              }}
            >
              <option value="all">{messagesCopy.allCompanies}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{messagesCopy.jobPosting}</span>
            <select
              value={jobPostingId}
              onChange={(event) => setJobPostingId(event.target.value)}
            >
              <option value="all">{messagesCopy.allJobPostings}</option>
              {postings.map((posting) => (
                <option key={posting.id} value={posting.id}>
                  {posting.title}
                </option>
              ))}
            </select>
          </label>
          {!ownerOversight ? (
            <label>
              <span>{messagesCopy.assignment}</span>
              <select
                value={assignment}
                onChange={(event) =>
                  setAssignment(event.target.value as typeof assignment)
                }
              >
                <option value="mine">{messagesCopy.assignedToMe}</option>
                <option value="unassigned">{messagesCopy.unassigned}</option>
                <option value="all">{messagesCopy.allCompanyThreads}</option>
              </select>
            </label>
          ) : null}
          {visible.length ? (
            visible.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === selectedId ? "is-selected" : undefined}
                onClick={() => {
                  if (item.id === selectedId) return;
                  setSelectedId(item.id);
                  setDetail(null);
                }}
              >
                <strong>{item.candidate.name}</strong>
                <span className="recruitment-messaging__job-title">
                  {item.job.title}
                </span>
                <span
                  className="recruitment-messaging__list-stage"
                  data-stage={item.applicationStage}
                >
                  {stageLabel(item.applicationStage, messagesCopy.stages)}
                </span>
                {item.unreadCount ? (
                  <span className="recruitment-messaging__unread-count">
                    {messagesCopy.unread(item.unreadCount)}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="recruitment-messaging__empty">
              {messagesCopy.noMatching}
            </p>
          )}
        </aside>
        <section className="recruitment-messaging__thread" aria-live="polite">
          {!detail || detail.thread.id !== selectedId ? (
            <p className="recruitment-messaging__empty">
              {messagesCopy.selectConversation}
            </p>
          ) : (
            <>
              <header className="recruitment-chat-header">
                <div>
                  <h2>{detail.thread.candidate.name}</h2>
                  <span>{detail.thread.job.title}</span>
                </div>
                <div className="recruitment-chat-header__meta">
                  <span
                    className="recruitment-chat-stage"
                    data-stage={detail.thread.applicationStage}
                  >
                    {stageLabel(
                      detail.thread.applicationStage,
                      messagesCopy.stages,
                    )}
                  </span>
                  <small>
                    {detail.access === "OWNER"
                      ? detail.thread.state === "READ_ONLY"
                        ? messagesCopy.readOnlyOversight
                        : detail.thread.canSend
                          ? messagesCopy.ownerCanSend
                          : messagesCopy.ownerAssignOrSend
                      : detail.thread.assignee
                        ? recruiterRoleLabel(detail.thread.assignee.role, copy)
                        : messagesCopy.unassigned}
                  </small>
                </div>
              </header>
              {canAssign ? (
                <form
                  className="recruitment-messaging__assignment"
                  onSubmit={assign}
                >
                  <label>
                    <span>{messagesCopy.assignToEligibleRole}</span>
                    <select
                      value={assigneeId}
                      onChange={(event) => setAssigneeId(event.target.value)}
                    >
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.user.name} ·{" "}
                          {recruiterRoleLabel(assignee.role, copy)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" disabled={busy || !assigneeId}>
                    {messagesCopy.saveAssignment}
                  </button>
                </form>
              ) : null}
              <div
                ref={chatHistoryRef}
                className="recruitment-messaging__messages recruitment-chat-history"
              >
                {detail.messages.length ? (
                  <>
                    <p className="recruitment-chat-history__start">
                      {messagesCopy.conversationStarted}
                    </p>
                    {detail.messages.map((message) => (
                      <div
                        key={message.id}
                        className="recruitment-chat-message"
                        data-direction={
                          message.senderUserId === detail.thread.candidate.id
                            ? "incoming"
                            : "outgoing"
                        }
                        aria-label={messagesCopy.messageFrom(
                          message.senderUserId === detail.thread.candidate.id
                            ? detail.thread.candidate.name
                            : detail.access === "OWNER"
                              ? (detail.thread.assignee?.name ??
                                messagesCopy.recruiterWorkspace)
                              : locale === "vi"
                                ? "bạn"
                                : "you",
                        )}
                      >
                        <span
                          className="recruitment-chat-message__avatar"
                          aria-hidden="true"
                        >
                          <UserRound />
                        </span>
                        <article
                          data-time={new Date(
                            message.createdAt,
                          ).toLocaleString()}
                        >
                          <div>{message.content}</div>
                          <time dateTime={message.createdAt} aria-hidden="true">
                            {new Date(message.createdAt).toLocaleString()}
                          </time>
                        </article>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="recruitment-messaging__empty">
                    {messagesCopy.noMessages}
                  </p>
                )}
              </div>
              {detail.access !== "OWNER" || detail.thread.canSend ? (
                <form className="recruitment-chat-composer" onSubmit={send}>
                  <label>
                    <span className="sr-only">{messagesCopy.message}</span>
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key !== "Enter" ||
                          event.shiftKey ||
                          event.nativeEvent.isComposing
                        ) {
                          return;
                        }
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }}
                      maxLength={2000}
                      disabled={!detail.thread.canSend || busy}
                      placeholder={
                        detail.thread.canSend
                          ? messagesCopy.writeMessage
                          : detail.access === "HR_MANAGER"
                            ? messagesCopy.onlyAssignedTeamMember
                            : messagesCopy.readOnlyConversation
                      }
                    />
                    <span
                      className="recruitment-chat-composer__count"
                      aria-live="polite"
                    >
                      {content.length}/2,000
                    </span>
                  </label>
                  <div className="recruitment-chat-composer__actions">
                    <span>{messagesCopy.sendHint}</span>
                    <button
                      type="submit"
                      disabled={
                        !detail.thread.canSend || busy || !content.trim()
                      }
                    >
                      {busy ? messagesCopy.sending : messagesCopy.send}{" "}
                      <SendHorizontal aria-hidden="true" />
                    </button>
                  </div>
                </form>
              ) : (
                <p className="recruitment-messaging__empty">
                  {detail.thread.state === "READ_ONLY"
                    ? messagesCopy.readOnlyAtStage
                    : messagesCopy.ownerCanSendAfterAssignment}
                </p>
              )}
            </>
          )}
        </section>
        <aside
          className="recruitment-messaging__context"
          aria-label={messagesCopy.candidateApplicationContext}
        >
          {!detail || detail.thread.id !== selectedId ? (
            <p className="recruitment-messaging__empty">
              {messagesCopy.selectConversation}
            </p>
          ) : (
            <>
              <header className="recruitment-messaging__context-header">
                <span aria-hidden="true">
                  {detail.thread.candidate.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p>{messagesCopy.candidate}</p>
                  <h2>{detail.thread.candidate.name}</h2>
                </div>
              </header>
              <dl className="recruitment-messaging__context-list">
                <div>
                  <dt>{messagesCopy.applicationStage}</dt>
                  <dd>
                    {stageLabel(
                      detail.thread.applicationStage,
                      messagesCopy.stages,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{messagesCopy.jobPosting}</dt>
                  <dd>{detail.thread.job.title}</dd>
                </div>
                <div>
                  <dt>{copy.company}</dt>
                  <dd>{detail.thread.job.companyName}</dd>
                </div>
                <div>
                  <dt>{messagesCopy.conversationOwner}</dt>
                  <dd>
                    {detail.thread.assignee?.name ?? messagesCopy.unassigned}
                    {detail.thread.assignee
                      ? ` · ${recruiterRoleLabel(detail.thread.assignee.role, copy)}`
                      : ""}
                  </dd>
                </div>
              </dl>
              <p className="recruitment-messaging__context-note">
                {messagesCopy.scopedNote}
              </p>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
