import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "@/backend/database/prisma";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import {
  parseWorkspaceMode,
  WORKSPACE_MODE_COOKIE,
} from "@/shared/utils/workspace-mode";
import { requireSession } from "./session/require-session";

/**
 * Request-memoized authenticated workspace projection.
 *
 * The route-group layout and protected child Server Components share this
 * result, so the Better Auth session is validated once per request. Only
 * display-safe account fields cross into the client shell.
 */
import { isCandidateRequestHost } from "@/backend/auth/candidate-host-boundary";
import { getRecruiterHeaderStatusService } from "@/backend/recruiter-header/recruiter-header-status-service-factory";

export const getWorkspaceContext = cache(async () => {
  const requestHeaders = await headers();
  const persistedWorkspaceMode = parseWorkspaceMode(
    (await cookies()).get(WORKSPACE_MODE_COOKIE)?.value,
  );
  const current = await requireSession(requestHeaders);
  if (!current) return null;

  const account = await prisma.userAccount.findUnique({
    where: { id: current.userId },
    select: {
      name: true,
      email: true,
      image: true,
      createdAt: true,
      twoFactorEnabled: true,
      preferences: {
        select: { language: true },
      },
      fullAccountRecoveryOperations: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!account) return null;

  let initialRecruiterStatus;
  try {
    if (isCandidateRequestHost(requestHeaders)) {
      initialRecruiterStatus =
        await getRecruiterHeaderStatusService().resolveForUser(current.userId);
    }
  } catch {
    initialRecruiterStatus = undefined;
  }

  return {
    userId: current.userId,
    sessionId: current.sessionId,
    csrfProof: csrfProof(current.sessionId),
    account: {
      name: account.name,
      email: account.email,
      image: account.image,
      createdAt: account.createdAt,
      twoFactorEnabled: account.twoFactorEnabled,
    },
    initialLocale:
      account.preferences?.language === "VI"
        ? ("vi" as const)
        : ("en" as const),
    initialWorkspaceMode: persistedWorkspaceMode ?? ("candidate" as const),
    hasPersistedWorkspaceMode: persistedWorkspaceMode !== null,
    recoveryCompleted: account.fullAccountRecoveryOperations.length > 0,
    initialRecruiterStatus,
  };
});
