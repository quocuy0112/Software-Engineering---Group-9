import "server-only";

import {
  MAX_APPLICATION_ATTEMPTS,
  MAX_APPLICATION_ATTEMPTS_MESSAGE,
} from "@/shared/contracts/jobs/actions";

export { MAX_APPLICATION_ATTEMPTS, MAX_APPLICATION_ATTEMPTS_MESSAGE };

export function isActiveApplication(row: {
  stage: string;
  withdrawalOutcome?: string | null;
}) {
  return !row.withdrawalOutcome && row.stage !== "REJECTED";
}

export function hasReachedApplicationLimit(applicationCount: number) {
  return applicationCount >= MAX_APPLICATION_ATTEMPTS;
}
