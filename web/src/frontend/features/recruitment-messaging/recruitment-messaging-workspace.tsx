"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  const [items, setItems] = useState(initialItems);
  const [assignment, setAssignment] = useState<"mine" | "unassigned" | "all">(
    ownerOversight ? "all" : "mine",
  );
  const [query, setQuery] = useState("");
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
  const hasInitialItems = initialItems.length > 0;

  const visible = useMemo(
    () =>
      items.filter((item) =>
        `${item.candidate.name} ${item.job.title} ${item.job.companyName}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      ),
    [items, query],
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
      .catch(() => setError("Could not load recruitment conversations."));
  }, [assignment, hasInitialItems, ownerOversight]);

  useEffect(() => {
    if (!selectedId) return;
    void responseJson<Detail>(
      ownerOversight
        ? `/api/recruiter/messages/oversight/threads/${encodeURIComponent(selectedId)}`
        : `/api/recruitment-threads/${encodeURIComponent(selectedId)}`,
    )
      .then((payload) => {
        setDetail(payload);
        setError(null);
      })
      .catch(() => {
        setDetail(null);
        setError("This recruitment conversation is no longer available.");
      });
  }, [ownerOversight, selectedId]);

  const managerThreadId =
    detail?.access === "HR_MANAGER" ? detail.thread.id : null;
  const assignedMembershipId =
    detail?.access === "HR_MANAGER" ? detail.thread.assignee?.id : null;

  useEffect(() => {
    if (!managerThreadId) return;
    void responseJson<{
      items: Array<{ id: string; role: string; user: { name: string } }>;
    }>(
      `/api/recruitment-threads/${encodeURIComponent(managerThreadId)}/assignees`,
    )
      .then((payload) => {
        setAssignees(payload.items);
        setAssigneeId(assignedMembershipId ?? payload.items[0]?.id ?? "");
      })
      .catch(() => setError("Could not load eligible assignees."));
  }, [assignedMembershipId, managerThreadId]);

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
          ? "Messaging is read-only for this application stage."
          : "Message could not be sent.",
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
      setError("Assignment could not be saved.");
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
        <p>{ownerOversight ? "Owner oversight" : "Recruiter workspace"}</p>
        <h1>
          {ownerOversight
            ? "Recruitment message oversight"
            : "Recruitment messages"}
        </h1>
        <span>
          Every conversation is scoped to one candidate application and one job.
        </span>
      </header>
      {error ? (
        <p className="recruitment-messaging__error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="recruitment-messaging__grid">
        <aside
          className="recruitment-messaging__list"
          aria-label="Recruitment conversations"
        >
          <label>
            <span>Search candidate or job</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages"
            />
          </label>
          {!ownerOversight ? (
            <label>
              <span>Assignment</span>
              <select
                value={assignment}
                onChange={(event) =>
                  setAssignment(event.target.value as typeof assignment)
                }
              >
                <option value="mine">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                <option value="all">All company threads</option>
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
                <span>
                  {item.job.title} · {item.job.companyName}
                </span>
                <small>
                  {item.applicationStage}
                  {item.unreadCount ? ` · ${item.unreadCount} unread` : ""}
                </small>
              </button>
            ))
          ) : (
            <p className="recruitment-messaging__empty">
              No conversations match this view.
            </p>
          )}
        </aside>
        <section className="recruitment-messaging__thread" aria-live="polite">
          {!detail || detail.thread.id !== selectedId ? (
            <p className="recruitment-messaging__empty">
              Select a conversation to see its application context.
            </p>
          ) : (
            <>
              <header className="recruitment-chat-header">
                <p>{detail.thread.job.companyName}</p>
                <h2>{detail.thread.candidate.name}</h2>
                <span>
                  {detail.thread.job.title} · {detail.thread.applicationStage} ·{" "}
                  {detail.access === "OWNER"
                    ? "Owner oversight (read-only)"
                    : (detail.thread.assignee?.role ?? "Unassigned")}
                </span>
              </header>
              {detail.access === "HR_MANAGER" ? (
                <form
                  className="recruitment-messaging__assignment"
                  onSubmit={assign}
                >
                  <label>
                    <span>Assigned recruiter</span>
                    <select
                      value={assigneeId}
                      onChange={(event) => setAssigneeId(event.target.value)}
                    >
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.user.name} · {assignee.role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" disabled={busy || !assigneeId}>
                    Save assignment
                  </button>
                </form>
              ) : null}
              <div className="recruitment-messaging__messages recruitment-chat-history">
                {detail.messages.length ? (
                  detail.messages.map((message) => (
                    <article
                      key={message.id}
                      data-direction={
                        message.senderUserId === detail.thread.candidate.id
                          ? "incoming"
                          : "outgoing"
                      }
                    >
                      <p>
                        {message.senderUserId === detail.thread.candidate.id
                          ? detail.thread.candidate.name
                          : detail.access === "OWNER"
                            ? (detail.thread.assignee?.name ??
                              "Recruitment team")
                            : "You"}
                      </p>
                      <div>{message.content}</div>
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleString()}
                      </time>
                    </article>
                  ))
                ) : (
                  <p className="recruitment-messaging__empty">
                    No messages yet. Keep the conversation focused on this
                    application.
                  </p>
                )}
              </div>
              {detail.access !== "OWNER" ? (
                <form className="recruitment-chat-composer" onSubmit={send}>
                  <label>
                    <span className="sr-only">Message</span>
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
                          ? "Write a message about this application"
                          : "This conversation is read-only"
                      }
                    />
                  </label>
                  <div className="recruitment-chat-composer__actions">
                    <span>
                      Enter / Ctrl+Enter to send. Shift+Enter for a new line.
                    </span>
                    <button
                      type="submit"
                      disabled={
                        !detail.thread.canSend || busy || !content.trim()
                      }
                    >
                      {busy ? "Sending…" : "Send message"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="recruitment-messaging__empty">
                  Owner oversight is read-only. Messages and read state are
                  unchanged.
                </p>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
