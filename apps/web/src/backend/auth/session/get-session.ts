import "server-only";
import { auth } from "@/backend/auth/cookies/config";
import { prisma } from "@/backend/database/prisma";

export async function getActiveSession(headers: Headers) {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session) return null;
  const user = await prisma.userAccount.findUnique({
    where: { id: session.user.id },
    select: {
      state: true,
      passwordResetOperations: {
        where: { finalizedAt: null },
        select: { id: true },
        take: 1,
      },
      fullAccountRecoveryOperations: {
        where: { status: { in: ["CONFIRMED_HOLD", "COMPLETING"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (
    !user ||
    user.state !== "ACTIVE" ||
    user.passwordResetOperations.length > 0 ||
    user.fullAccountRecoveryOperations.length > 0
  ) {
    await auth.api.signOut({ headers });
    return null;
  }
  return session;
}
