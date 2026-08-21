"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, TriangleAlert, X } from "lucide-react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { privateMatchCopy } from "../i18n/private-match-copy";
import {
  privateMatchErrorMessage,
  useDeletePrivateCvMatch,
} from "../client/use-private-cv-match";

export function PrivateMatchDeleteControl({
  checkId,
  compact = false,
  onDeleted,
}: {
  checkId: string;
  compact?: boolean;
  onDeleted?: () => void;
}) {
  const locale = useWorkspaceLocale();
  const copy = privateMatchCopy(locale).delete;
  const router = useRouter();
  const deletion = useDeletePrivateCvMatch(checkId);
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletion.isPending) setOpen(false);
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [deletion.isPending, open]);

  async function remove() {
    try {
      await deletion.mutateAsync();
      setOpen(false);
      if (onDeleted) onDeleted();
      else router.push("/cv-match-check");
    } catch {
      // The mapped error is shown in the dialog without exposing ownership state.
    }
  }

  return (
    <div
      className={
        compact
          ? "private-match-delete-control is-compact"
          : "private-match-delete-control"
      }
    >
      <button
        className="private-match-delete-link"
        type="button"
        onClick={() => setOpen(true)}
        disabled={deletion.isPending}
        aria-haspopup="dialog"
      >
        <Trash2 aria-hidden="true" /> {compact ? copy.short : copy.trigger}
      </button>
      {open
        ? createPortal(
            <div
              className="private-match-modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !deletion.isPending
                ) {
                  setOpen(false);
                }
              }}
            >
              <section
                ref={modalRef}
                className="private-match-delete-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`delete-private-match-title-${checkId}`}
                aria-describedby={`delete-private-match-description-${checkId}`}
              >
                <header>
                  <div className="private-match-modal-icon">
                    <TriangleAlert aria-hidden="true" />
                  </div>
                  <div>
                    <h2 id={`delete-private-match-title-${checkId}`}>
                      {copy.title}
                    </h2>
                    <p id={`delete-private-match-description-${checkId}`}>
                      {copy.description}
                    </p>
                  </div>
                  <button
                    className="private-match-modal-close"
                    type="button"
                    aria-label={copy.close}
                    onClick={() => setOpen(false)}
                    disabled={deletion.isPending}
                  >
                    <X aria-hidden="true" />
                  </button>
                </header>
                <div className="private-match-modal-privacy">
                  <ShieldCheck aria-hidden="true" />
                  <span>{copy.privacy}</span>
                </div>
                {deletion.isError ? (
                  <p className="private-match-inline-error" role="alert">
                    {privateMatchErrorMessage(deletion.error, locale)}
                  </p>
                ) : null}
                <div className="private-match-modal-actions">
                  <button
                    ref={cancelRef}
                    className="private-match-secondary-button"
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={deletion.isPending}
                  >
                    {copy.keep}
                  </button>
                  <button
                    className="private-match-danger-button"
                    type="button"
                    onClick={() => void remove()}
                    disabled={deletion.isPending}
                  >
                    <Trash2 aria-hidden="true" />{" "}
                    {deletion.isPending ? copy.deleting : copy.confirm}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
