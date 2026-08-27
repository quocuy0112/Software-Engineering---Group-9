"use client";

import { useEffect, useRef, useState } from "react";
import {
  useJobInteraction,
  type JobInteractionSeed,
} from "./job-interaction-provider";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobCopy } from "./job-copy";

export function JobOverflowMenu({
  jobId,
  seed,
  onQuickView,
}: {
  jobId: string;
  seed: JobInteractionSeed;
  onQuickView: () => void;
}) {
  const copy = jobCopy(useWorkspaceLocale());
  const interaction = useJobInteraction(jobId, seed);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  return (
    <div className="job-overflow-menu" ref={menuRef}>
      <button
        className="job-icon-button"
        type="button"
        aria-label={copy.jobActions}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open ? (
        <div className="job-overflow-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onQuickView();
            }}
          >
            <span aria-hidden="true">◫</span>
            {copy.quickView}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              interaction.hide();
            }}
          >
            <span aria-hidden="true">◌</span>
            {copy.hideJob}
          </button>
        </div>
      ) : null}
    </div>
  );
}
