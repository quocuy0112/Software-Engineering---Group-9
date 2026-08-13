import "server-only";
import { PrismaConnectionRepository } from "@/backend/repositories/connections/prisma-connection-repository";

export async function runProposalRetentionCycle(now = new Date()) {
  return new PrismaConnectionRepository().runTransaction((repository) =>
    repository.purgeDue(now, 100),
  );
}
