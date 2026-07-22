import "server-only";
import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function getActiveSession(headers: Headers) {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session) return null;
  const user = await prisma.userAccount.findUnique({
    where: { id: session.user.id },
    select: { state: true },
  });
  if (!user || user.state !== "ACTIVE") {
    await auth.api.signOut({ headers });
    return null;
  }
  return session;
}
