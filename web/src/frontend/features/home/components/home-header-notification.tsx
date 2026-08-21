"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { NotificationCenter } from "@/frontend/features/notifications/components/notification-center";
import type { HomeCopy } from "../home-copy";
import type { HomeLocale, HomeViewer } from "../home-page-model";

type GuestNotificationLabels = Pick<
  HomeCopy["account"],
  | "login"
  | "signup"
  | "notificationLabel"
  | "notificationPromptTitle"
  | "notificationPromptDescription"
>;

export function HomeHeaderNotification({
  viewer,
  locale,
  labels,
}: {
  viewer: HomeViewer;
  locale: HomeLocale;
  labels: GuestNotificationLabels;
}) {
  if (viewer.kind !== "guest")
    return <NotificationCenter csrfProof={viewer.csrfProof} locale={locale} />;

  return <GuestNotification labels={labels} />;
}

function GuestNotification({ labels }: { labels: GuestNotificationLabels }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="home-header-notification" ref={rootRef}>
      <button
        type="button"
        className="notification-bell"
        aria-label={labels.notificationLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
      </button>
      {open ? (
        <section
          id={panelId}
          className="home-header-notification__guest-panel"
          aria-label={labels.notificationLabel}
        >
          <span className="home-header-notification__icon" aria-hidden="true">
            <BellIcon />
          </span>
          <div>
            <h2>{labels.notificationPromptTitle}</h2>
            <p>{labels.notificationPromptDescription}</p>
          </div>
          <div className="home-header-notification__guest-actions">
            <Link href="/login?returnTo=%2F" onClick={() => setOpen(false)}>
              {labels.login}
            </Link>
            <Link
              className="home-button home-button--small"
              href="/register"
              onClick={() => setOpen(false)}
            >
              {labels.signup}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}
