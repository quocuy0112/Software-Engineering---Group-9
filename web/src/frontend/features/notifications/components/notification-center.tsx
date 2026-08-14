"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AppProviders } from "@/frontend/providers/app-providers";
import {
  useNotificationMutations,
  useNotificationPages,
  useNotificationUnreadCount,
  type NotificationMutationAuth,
} from "../client/use-notifications";
import { notificationCopy, notificationTime } from "../notification-copy";
import type { NotificationItem } from "@/shared/contracts/notifications";

export function NotificationCenter(
  props: NotificationMutationAuth & {
    locale?: "vi" | "en";
    viewAllHref?: string;
  },
) {
  return (
    <AppProviders>
      <NotificationCenterContent {...props} />
    </AppProviders>
  );
}

function NotificationCenterContent({
  locale = "en",
  viewAllHref = "/notifications",
  ...auth
}: NotificationMutationAuth & {
  locale?: "vi" | "en";
  viewAllHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const router = useRouter();
  const copy = notificationCopy[locale];
  const count = useNotificationUnreadCount();
  const pages = useNotificationPages({ enabled: open, limit: 8 });
  const { markRead, markAllRead } = useNotificationMutations(auth);
  const items = pages.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = count.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function openItem(item: NotificationItem) {
    try {
      if (!item.readAt)
        await markRead.mutateAsync({ notificationId: item.id });
      setOpen(false);
      if (item.href) router.push(item.href);
    } catch {
      toast.error(copy.error);
    }
  }

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-bell"
        aria-label={`${copy.label}: ${unreadCount} ${copy.unread.toLowerCase()}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount > 0 ? (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          id={panelId}
          className="notification-panel"
          aria-label={copy.title}
          aria-live="polite"
        >
          <header className="notification-panel__header">
            <h2>{copy.title}</h2>
            <button
              type="button"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() =>
                markAllRead.mutateAsync({}).catch(() => toast.error(copy.error))
              }
            >
              {copy.markAll}
            </button>
          </header>
          {pages.isPending ? (
            <p className="notification-state" aria-busy="true">
              {copy.loading}
            </p>
          ) : pages.isError ? (
            <div className="notification-state" role="alert">
              <p>{copy.error}</p>
              <button type="button" onClick={() => void pages.refetch()}>
                {copy.retry}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="notification-state">{copy.empty}</p>
          ) : (
            <ul className="notification-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="notification-item"
                    data-read={Boolean(item.readAt)}
                    data-severity={item.severity}
                    onClick={() => void openItem(item)}
                  >
                    <span className="notification-item__meta">
                      <span>{copy.severities[item.severity]}</span>
                      <span>{item.readAt ? copy.read : copy.unread}</span>
                    </span>
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                    <time dateTime={item.lastOccurredAt}>
                      {notificationTime(item.lastOccurredAt, locale)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <footer className="notification-panel__footer">
            {viewAllHref.startsWith("#") ? (
              <a href={viewAllHref} onClick={() => setOpen(false)}>
                {copy.viewAll}
              </a>
            ) : (
              <Link href={viewAllHref} onClick={() => setOpen(false)}>
                {copy.viewAll}
              </Link>
            )}
          </footer>
        </section>
      ) : null}
    </div>
  );
}
