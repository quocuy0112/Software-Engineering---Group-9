"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { savedJobOutcomeSchema } from "@/shared/contracts/jobs/actions";
import {
  userJobStateViewSchema,
  type UserJobState,
} from "@/shared/contracts/jobs/catalog";

export type JobInteractionSeed = {
  saved: boolean;
  applied: boolean;
  hidden?: boolean;
};

export type JobInteractionRecord = JobInteractionSeed & {
  hidden: boolean;
};

type FilterPreset = UserJobState["savedFilterPresets"][number];
type UserJobStateMutation =
  | { action: "hide"; jobId: string }
  | { action: "unhide"; jobId: string };

type JobInteractionContextValue = {
  records: Record<string, JobInteractionRecord>;
  registerJob: (jobId: string, seed: JobInteractionSeed) => void;
  toggleSaved: (jobId: string) => Promise<boolean>;
  markApplied: (jobId: string) => void;
  hideJob: (jobId: string) => void;
  undoHide: (jobId: string) => void;
  savedFilterPresets: FilterPreset[];
  saveFilterPreset: (name: string, filters: Record<string, unknown>) => void;
};

const JobInteractionContext = createContext<JobInteractionContextValue | null>(
  null,
);

function syncUserJobState(
  csrfProof: string,
  mutation: UserJobStateMutation,
): Promise<void> {
  return mutateWithCurrentCsrf(
    "/api/jobs/user-state",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutation),
    },
    csrfProof,
  ).then(async (response) => {
    if (!response.ok) return;
    userJobStateViewSchema.parse(await response.json());
  });
}

async function readUserJobStateView() {
  try {
    const response = await fetch("/api/jobs/user-state", {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return userJobStateViewSchema.parse(await response.json());
  } catch {
    return null;
  }
}

export function JobInteractionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const csrfProof = useCsrfProof();
  const [records, setRecords] = useState<Record<string, JobInteractionRecord>>(
    {},
  );
  const [savedFilterPresets, setSavedFilterPresets] = useState<FilterPreset[]>(
    [],
  );

  useEffect(() => {
    let active = true;
    void readUserJobStateView().then((view) => {
      if (!active || !view) return;
      setRecords((current) => {
        const next = { ...current };
        let changed = false;
        const ids = new Set([...view.savedJobIds, ...view.hiddenJobIds]);
        for (const jobId of ids) {
          const existing = next[jobId] ?? {
            saved: false,
            applied: false,
            hidden: false,
          };
          const updated = {
            ...existing,
            saved: existing.saved || view.savedJobIds.includes(jobId),
            applied: existing.applied,
            hidden: existing.hidden || view.hiddenJobIds.includes(jobId),
          };
          next[jobId] = updated;
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const registerJob = useCallback((jobId: string, seed: JobInteractionSeed) => {
    setRecords((current) => {
      if (current[jobId]) return current;
      return {
        ...current,
        [jobId]: {
          saved: seed.saved,
          applied: seed.applied,
          hidden: seed.hidden ?? false,
        },
      };
    });
  }, []);

  const toggleSaved = useCallback(
    async (jobId: string) => {
      const current = records[jobId]?.saved ?? false;
      const response = await mutateWithCurrentCsrf(
        "/api/saved-jobs/" + encodeURIComponent(jobId),
        { method: current ? "DELETE" : "PUT" },
        csrfProof,
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const problem = body as { message?: unknown };
        throw new Error(
          typeof problem.message === "string"
            ? problem.message
            : "Could not update this saved job. Try again.",
        );
      }
      const outcome = savedJobOutcomeSchema.parse(body);
      setRecords((state) => ({
        ...state,
        [jobId]: {
          saved: outcome.saved,
          applied: state[jobId]?.applied ?? false,
          hidden: state[jobId]?.hidden ?? false,
        },
      }));
      toast(outcome.saved ? "Saved to Saved Jobs" : "Removed from Saved Jobs");
      return outcome.saved;
    },
    [csrfProof, records],
  );

  const markApplied = useCallback((jobId: string) => {
    setRecords((state) => ({
      ...state,
      [jobId]: {
        saved: state[jobId]?.saved ?? false,
        applied: true,
        hidden: state[jobId]?.hidden ?? false,
      },
    }));
  }, []);

  const undoHide = useCallback(
    (jobId: string) => {
      setRecords((state) => ({
        ...state,
        [jobId]: {
          saved: state[jobId]?.saved ?? false,
          applied: state[jobId]?.applied ?? false,
          hidden: false,
        },
      }));
      void syncUserJobState(csrfProof, { action: "unhide", jobId }).catch(
        () => undefined,
      );
    },
    [csrfProof],
  );

  const hideJob = useCallback(
    (jobId: string) => {
      setRecords((state) => ({
        ...state,
        [jobId]: {
          saved: state[jobId]?.saved ?? false,
          applied: state[jobId]?.applied ?? false,
          hidden: true,
        },
      }));
      void syncUserJobState(csrfProof, { action: "hide", jobId }).catch(
        () => undefined,
      );
      toast("Job hidden from your list", {
        description: "You can undo this for the next 5 seconds.",
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => undoHide(jobId),
        },
      });
    },
    [csrfProof, undoHide],
  );

  const saveFilterPreset = useCallback(
    (name: string, filters: Record<string, unknown>) => {
      const preset: FilterPreset = {
        id:
          globalThis.crypto?.randomUUID?.() ??
          "preset-" + Date.now() + "-" + Math.random().toString(36).slice(2),
        name: name.trim(),
        filters,
      };
      setSavedFilterPresets((current) => [preset, ...current].slice(0, 100));
      toast("Filter saved", {
        description: "\u201c" + preset.name + "\u201d is ready to reuse.",
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      records,
      registerJob,
      toggleSaved,
      markApplied,
      hideJob,
      undoHide,
      savedFilterPresets,
      saveFilterPreset,
    }),
    [
      hideJob,
      markApplied,
      records,
      registerJob,
      saveFilterPreset,
      savedFilterPresets,
      toggleSaved,
      undoHide,
    ],
  );

  return (
    <JobInteractionContext.Provider value={value}>
      {children}
    </JobInteractionContext.Provider>
  );
}

export function useJobInteraction(
  jobId: string,
  seed: JobInteractionSeed,
): JobInteractionRecord & {
  toggleSaved: () => Promise<boolean>;
  markApplied: () => void;
  hide: () => void;
  undoHide: () => void;
} {
  const context = useContext(JobInteractionContext);
  if (!context) {
    throw new Error(
      "useJobInteraction must be used within JobInteractionProvider",
    );
  }

  const registerJob = context.registerJob;
  useEffect(() => {
    registerJob(jobId, {
      saved: seed.saved,
      applied: seed.applied,
      hidden: seed.hidden,
    });
  }, [jobId, registerJob, seed.applied, seed.hidden, seed.saved]);

  const record = context.records[jobId] ?? {
    saved: seed.saved,
    applied: seed.applied,
    hidden: seed.hidden ?? false,
  };

  return {
    ...record,
    toggleSaved: () => context.toggleSaved(jobId),
    markApplied: () => context.markApplied(jobId),
    hide: () => context.hideJob(jobId),
    undoHide: () => context.undoHide(jobId),
  };
}

export function useOptionalJobInteraction() {
  return useContext(JobInteractionContext);
}
