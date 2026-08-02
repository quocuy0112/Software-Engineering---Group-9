"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

const activeGuards = new Map<symbol, string>();
let listening = false;

function activeMessage() {
  return activeGuards.values().next().value as string | undefined;
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (activeGuards.size === 0) return;
  event.preventDefault();
  event.returnValue = "";
}

function onDocumentClick(event: MouseEvent) {
  if (
    activeGuards.size === 0 ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (
    !anchor ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download")
  ) {
    return;
  }
  const destination = new URL(anchor.href, window.location.href);
  if (
    destination.origin !== window.location.origin ||
    (destination.pathname === window.location.pathname &&
      destination.search === window.location.search)
  ) {
    return;
  }
  const message = activeMessage();
  if (message && !window.confirm(message)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function syncListeners() {
  if (typeof window === "undefined") return;
  if (activeGuards.size > 0 && !listening) {
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    listening = true;
  } else if (activeGuards.size === 0 && listening) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onDocumentClick, true);
    listening = false;
  }
}

export function useUnsavedChangesGuard(dirty: boolean) {
  const locale = useWorkspaceLocale();
  const id = useRef(Symbol("unsaved-profile-section"));
  const message =
    locale === "vi"
      ? "Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời khỏi trang?"
      : "You have unsaved changes. Are you sure you want to leave this page?";

  useEffect(() => {
    const guardId = id.current;
    if (dirty) activeGuards.set(guardId, message);
    else activeGuards.delete(guardId);
    syncListeners();
    return () => {
      activeGuards.delete(guardId);
      syncListeners();
    };
  }, [dirty, message]);
}

export function UnsavedChangesIndicator({ dirty }: { dirty: boolean }) {
  const locale = useWorkspaceLocale();
  if (!dirty) return null;
  return (
    <span className="profile-unsaved-indicator" aria-live="polite">
      <span aria-hidden="true" />
      {locale === "vi" ? "Chưa lưu" : "Unsaved"}
    </span>
  );
}
