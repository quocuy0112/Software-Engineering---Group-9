import "server-only";
import { prisma } from "@/backend/database/prisma";
export async function runRationaleRetentionCycle(
  now = new Date(),
  limit = 100,
) {
  const due = await prisma.privilegedActionRationale.findMany({
    where: { deleteAfter: { lte: now }, deletedAt: null },
    select: { id: true },
    take: limit,
  });
  if (due.length)
    await prisma.privilegedActionRationale.updateMany({
      where: { id: { in: due.map((row) => row.id) } },
      data: { ciphertext: "", iv: "", authenticationTag: "", deletedAt: now },
    });
  return { deleted: due.length };
}
