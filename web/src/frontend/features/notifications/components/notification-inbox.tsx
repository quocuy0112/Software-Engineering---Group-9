"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppProviders } from "@/frontend/providers/app-providers";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  useNotificationMutations,
  useNotificationPages,
  type NotificationMutationAuth,
} from "../client/use-notifications";
import { notificationCopy, notificationTime } from "../notification-copy";

export function NotificationInbox() {
  const csrfProof = useCsrfProof();
  const locale = useWorkspaceLocale();
  return (
    <AppProviders>
      <NotificationInboxContent auth={{ csrfProof }} locale={locale} />
    </AppProviders>
  );
}

export function AdminNotificationInbox({
  getCsrfProof,
}: {
  getCsrfProof: () => string | null;
}) {
  return (
    <AppProviders>
      <NotificationInboxContent auth={{ getCsrfProof }} locale="en" />
    </AppProviders>
  );
}

function NotificationInboxContent({
  auth,
  locale,
}: {
  auth: NotificationMutationAuth;
  locale: "vi" | "en";
}) {
  const [state, setState] = useState<"all" | "unread" | "read">("all");
  const copy = notificationCopy[locale];
  const pages = useNotificationPages({ enabled: true, limit: 20, state });
  const { markRead, markAllRead } = useNotificationMutations(auth);
  const items = pages.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="notification-inbox" aria-labelledby="notification-inbox-title">
      <header className="notification-inbox__header">
        <div>
          <p className="notification-inbox__eyebrow">SmartHire</p>
          <h1 id="notification-inbox-title">{copy.title}</h1>
        </div>
        <button
          type="button"
          onClick={() =>
            markAllRead.mutateAsync({}).catch(() => toast.error(copy.error))
          }
        >
          {copy.markAll}
        </button>
      </header>
      <div className="notification-filters" aria-label={copy.title}>
        {(["all", "unread", "read"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={state === value}
            onClick={() => setState(value)}
          >
            {value === "all" ? copy.label : value === "unread" ? copy.unread : copy.read}
          </button>
        ))}
      </div>
      {pages.isPending ? (
        <p className="notification-state" aria-busy="true">{copy.loading}</p>
      ) : pages.isError ? (
        <div className="notification-state" role="alert">
          <p>{copy.error}</p>
          <button type="button" onClick={() => void pages.refetch()}>{copy.retry}</button>
        </div>
      ) : items.length === 0 ? (
        <p className="notification-state">{copy.empty}</p>
      ) : (
        <ul className="notification-inbox__list">
          {items.map((item) => (
            <li key={item.id} data-read={Boolean(item.readAt)} data-severity={item.severity}>
              <div>
                <span className="notification-item__meta">
                  <span>{copy.severities[item.severity]}</span>
                  <span>{item.readAt ? copy.read : copy.unread}</span>
                </span>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                <time dateTime={item.lastOccurredAt}>{notificationTime(item.lastOccurredAt, locale)}</time>
              </div>
              {!item.readAt ? (
                <button
                  type="button"
                  onClick={() =>
                    markRead
                      .mutateAsync({ notificationId: item.id })
                      .catch(() => toast.error(copy.error))
                  }
                >
                  {copy.read}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {pages.hasNextPage ? (
        <button
          className="notification-load-more"
          type="button"
          disabled={pages.isFetchingNextPage}
          onClick={() => void pages.fetchNextPage()}
        >
          {copy.loadMore}
        </button>
      ) : null}
    </section>
  );
}
