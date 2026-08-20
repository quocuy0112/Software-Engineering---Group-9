"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Modal } from "@/frontend/components/ui/modal";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

const activeGuards = new Set<symbol>();
type PendingNavigation = { navigate: () => void };
let pendingNavigation: PendingNavigation | null = null;
let bypassBeforeUnload = false;
const subscribers = new Set<() => void>();
let listening = false;

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getPendingNavigation() {
  return pendingNavigation;
}

function openNavigationDialog(navigate: () => void) {
  pendingNavigation = { navigate };
  notifySubscribers();
}

/** Returns true when navigation started immediately, false when confirmation is required. */
export function requestUnsavedChangesNavigation(navigate: () => void) {
  if (activeGuards.size === 0) {
    navigate();
    return true;
  }
  openNavigationDialog(navigate);
  return false;
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (activeGuards.size === 0 || bypassBeforeUnload) return;
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
  event.preventDefault();
  event.stopPropagation();
  requestUnsavedChangesNavigation(() =>
    window.location.assign(destination.href),
  );
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
  const id = useRef(Symbol("unsaved-profile-section"));

  useEffect(() => {
    const guardId = id.current;
    if (dirty) activeGuards.add(guardId);
    else activeGuards.delete(guardId);
    syncListeners();
    return () => {
      activeGuards.delete(guardId);
      syncListeners();
    };
  }, [dirty]);
}

export function UnsavedChangesNavigationDialog() {
  const pending = useSyncExternalStore(
    subscribe,
    getPendingNavigation,
    getPendingNavigation,
  );
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          title: "Bạn có thay đổi chưa lưu",
          description:
            "Nếu rời khỏi trang này, các thay đổi chưa lưu sẽ bị mất.",
          stay: "Ở lại trang",
          leave: "Rời khỏi trang",
        }
      : {
          title: "You have unsaved changes",
          description:
            "Leaving this page will discard any changes that have not been saved.",
          stay: "Stay on page",
          leave: "Leave page",
        };

  function close() {
    pendingNavigation = null;
    notifySubscribers();
  }

  function confirmLeave() {
    const navigation = pendingNavigation;
    close();
    if (!navigation) return;
    bypassBeforeUnload = true;
    navigation.navigate();
    window.setTimeout(() => {
      bypassBeforeUnload = false;
    }, 0);
  }

  return (
    <Modal
      open={Boolean(pending)}
      title={copy.title}
      description={copy.description}
      tone="destructive"
      onClose={close}
    >
      <div className="profile-unsaved-navigation-actions">
        <button
          type="button"
          className="btn-secondary stay-button"
          data-autofocus
          onClick={close}
        >
          {copy.stay}
        </button>
        <button
          type="button"
          className="btn-danger leave-button"
          onClick={confirmLeave}
        >
          {copy.leave}
        </button>
      </div>
    </Modal>
  );
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
