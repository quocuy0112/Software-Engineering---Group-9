import "server-only";

import { headers } from "next/headers";
import { requireSession } from "@/backend/auth/session/require-session";
import { prisma } from "@/backend/database/prisma";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";

export async function getHomePageContext() {
  const current = await requireSession(await headers());
  if (!current) return null;

  const profile = await prisma.userAccount.findUnique({
    where: { id: current.userId },
    select: { name: true, email: true, image: true },
  });
  if (!profile) return null;

  return {
    profile,
    csrfProof: csrfProof(current.sessionId),
  };
}
