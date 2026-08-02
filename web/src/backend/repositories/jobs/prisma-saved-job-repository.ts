import "server-only";
import { prisma } from "@/backend/database/prisma";

export type SavedJobRepositoryPort = {
  save(userId: string, jobId: string): Promise<boolean>;
  remove(userId: string, jobId: string): Promise<boolean>;
};

export class PrismaSavedJobRepository implements SavedJobRepositoryPort {
  constructor(private readonly db: typeof prisma = prisma) {}

  async save(userId: string, jobId: string) {
    await this.db.savedJob.createMany({
      data: { userId, jobPostingId: jobId },
      skipDuplicates: true,
    });
    return true;
  }

  async remove(userId: string, jobId: string) {
    await this.db.savedJob.deleteMany({
      where: { userId, jobPostingId: jobId },
    });
    return false;
  }
}
