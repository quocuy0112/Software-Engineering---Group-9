import { prisma } from "@/backend/database/prisma";

export async function cleanupAdministratorNotificationsForContexts(
  contextIds: readonly string[],
) {
  const uniqueContextIds = [...new Set(contextIds.filter(Boolean))];
  if (uniqueContextIds.length === 0) return;
  await prisma.inAppNotification.deleteMany({
    where: {
      audience: "ADMIN",
      contextId: { in: uniqueContextIds },
    },
  });
}
