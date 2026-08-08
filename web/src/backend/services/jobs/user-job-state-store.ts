import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  userJobStateSchema,
  type JobPreferences,
  type UserJobState,
} from "@/shared/contracts/jobs/catalog";

const stateFilePath = resolve(
  process.cwd(),
  "data",
  "jobs",
  "user-job-state.json",
);

let pendingWrite: Promise<void> = Promise.resolve();

export type UserJobStateMutation =
  | { action: "save"; jobId: string }
  | { action: "unsave"; jobId: string }
  | { action: "hide"; jobId: string }
  | { action: "unhide"; jobId: string }
  | { action: "update-preferences"; jobPreferences: JobPreferences };

export function userJobStateFileEnabled() {
  return process.env.NODE_ENV !== "production";
}

export async function readUserJobState(): Promise<UserJobState> {
  const text = await readFile(stateFilePath, "utf8");
  return userJobStateSchema.parse(JSON.parse(text));
}

export function projectUserJobState(state: UserJobState) {
  return {
    savedJobIds: state.savedJobIds,
    hiddenJobIds: state.hiddenJobIds,
  };
}

export function updateUserJobState(mutation: UserJobStateMutation) {
  const operation = pendingWrite.then(async () => {
    const current = await readUserJobState();
    let next: UserJobState = current;

    switch (mutation.action) {
      case "save":
        next = current.savedJobIds.includes(mutation.jobId)
          ? current
          : {
              ...current,
              savedJobIds: [...current.savedJobIds, mutation.jobId],
            };
        break;
      case "unsave":
        next = {
          ...current,
          savedJobIds: current.savedJobIds.filter(
            (jobId) => jobId !== mutation.jobId,
          ),
        };
        break;
      case "hide":
        next = current.hiddenJobIds.includes(mutation.jobId)
          ? current
          : {
              ...current,
              hiddenJobIds: [...current.hiddenJobIds, mutation.jobId],
            };
        break;
      case "unhide":
        next = {
          ...current,
          hiddenJobIds: current.hiddenJobIds.filter(
            (jobId) => jobId !== mutation.jobId,
          ),
        };
        break;
      case "update-preferences":
        next = {
          ...current,
          jobPreferences: mutation.jobPreferences,
        };
        break;
    }

    if (next !== current) {
      await writeFile(
        stateFilePath,
        JSON.stringify(next, null, 2) + "\n",
        "utf8",
      );
    }
    return next;
  });

  pendingWrite = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}
