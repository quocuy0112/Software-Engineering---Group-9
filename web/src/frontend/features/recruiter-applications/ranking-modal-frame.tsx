"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationDetailCopy } from "./application-detail-copy";

export function RankingModalFrame({
  title,
  subtitle,
  icon,
  children,
  info,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  destructive = false,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children?: React.ReactNode;
  info: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  destructive?: boolean;
}) {
  const locale = useWorkspaceLocale();
  const copy = applicationDetailCopy(locale).drawer;
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const cancel = dialog.current?.querySelector<HTMLElement>(
      "[data-modal-cancel]",
    );
    const focusable =
      cancel ??
      dialog.current?.querySelector<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onCancel]);
  return (
    <div
      className="ai-ranking-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="ai-ranking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-ranking-modal-title"
        ref={dialog}
      >
        <header className="ai-ranking-modal__header">
          <span
            className={
              "ai-ranking-modal__icon " +
              (destructive ? "ai-ranking-modal__icon--danger" : "")
            }
            aria-hidden="true"
          >
            {icon}
          </span>
          <div>
            <h2 id="ai-ranking-modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            type="button"
            className="ai-ranking-icon-button"
            onClick={onCancel}
            aria-label={copy.closeDialog}
          >
            &times;
          </button>
        </header>
        <div className="ai-ranking-modal__body">
          {children}
          <div className="ai-ranking-modal__callout">{info}</div>
        </div>
        <footer>
          <button
            type="button"
            data-modal-cancel
            className="ai-ranking-button ai-ranking-button--secondary"
            onClick={onCancel}
          >
            {cancelLabel ?? (locale === "vi" ? "Hủy" : "Cancel")}
          </button>
          <button
            type="button"
            className={
              "ai-ranking-button " +
              (destructive
                ? "ai-ranking-button--danger"
                : "ai-ranking-button--primary")
            }
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
