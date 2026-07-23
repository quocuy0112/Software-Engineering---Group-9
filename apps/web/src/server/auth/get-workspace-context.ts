import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { csrfProof } from "@/lib/security/csrf-proof";
import { requireSession } from "./require-session";

/**
 * Request-memoized authenticated workspace projection.
 *
 * The route-group layout and protected child Server Components share this
 * result, so the Better Auth session is validated once per request. Only
 * display-safe account fields cross into the client shell.
 */
export const getWorkspaceContext = cache(async () => {
  const current = await requireSession(await headers());
  if (!current) return null;

  const account = await prisma.userAccount.findUnique({
    where: { id: current.userId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      twoFactorEnabled: true,
      fullAccountRecoveryOperations: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!account) return null;

  return {
    userId: current.userId,
    sessionId: current.sessionId,
    csrfProof: csrfProof(current.sessionId),
    account: {
      name: account.name,
      email: account.email,
      createdAt: account.createdAt,
      twoFactorEnabled: account.twoFactorEnabled,
    },
    recoveryCompleted: account.fullAccountRecoveryOperations.length > 0,
  };
});
