"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const copy = notificationCopy[locale];
  const pages = useNotificationPages({ enabled: true, limit: 20, state });
  const { markRead, markAllRead } = useNotificationMutations(auth);
  const items = pages.data?.pages.flatMap((page) => page.items) ?? [];

  async function openItem(item: (typeof items)[number]) {
    try {
      if (!item.readAt) {
        await markRead.mutateAsync({ notificationId: item.id });
      }
      if (item.href) router.push(item.href);
    } catch {
      toast.error(copy.error);
    }
  }

  return (
    <section className="notification-inbox" aria-labelledby="notification-inbox-title">
      <div className="notification-inbox__card">
        <header className="notification-inbox__header">
          <div className="notification-inbox__title-group">
            <span className="notification-inbox__eyebrow">SMARTHIRE</span>
            <h1 id="notification-inbox-title">{copy.title}</h1>
          </div>
          <button
            type="button"
            className="notification-inbox__mark-all"
            disabled={items.length === 0 || items.every((item) => Boolean(item.readAt)) || markAllRead.isPending}
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
              className="notification-filter-btn"
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
              <li
                key={item.id}
                data-read={Boolean(item.readAt)}
                data-severity={item.severity}
                className="notification-inbox__item"
              >
                {!item.readAt ? (
                  <span className="notification-inbox__accent" aria-hidden="true" />
                ) : null}
                <button
                  type="button"
                  className="notification-inbox__open"
                  onClick={() => void openItem(item)}
                >
                  <div className="notification-item__meta">
                    <span className="notification-item__severity">{copy.severities[item.severity]}</span>
                    <span className="notification-item__status">{item.readAt ? copy.read : copy.unread}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.summary}</p>
                  <time dateTime={item.lastOccurredAt}>{notificationTime(item.lastOccurredAt, locale)}</time>
                </button>
                {!item.readAt ? (
                  <div className="notification-inbox__action-col">
                    <button
                      type="button"
                      className="notification-inbox__mark-read"
                      onClick={() =>
                        markRead
                          .mutateAsync({ notificationId: item.id })
                          .catch(() => toast.error(copy.error))
                      }
                    >
                      {copy.readAction}
                    </button>
                  </div>
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
      </div>
    </section>
  );
}
