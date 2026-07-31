import "server-only";
import { prisma } from "@/backend/database/prisma";
import type { AccountPreferencesMutation } from "@/shared/contracts/account/preferences";

export class AccountPreferencesPersistenceError extends Error {
  constructor() {
    super("ACCOUNT_PREFERENCES_PERSISTENCE_FAILED");
  }
}

export class PrismaAccountPreferencesRepository {
  find(userId: string) {
    return prisma.accountPreferences.findUnique({ where: { userId } });
  }

  async replace(userId: string, input: AccountPreferencesMutation) {
    try {
      return await prisma.$transaction(async (tx) => {
        const account = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "user"
          WHERE "id" = ${userId}
            AND "state" = 'ACTIVE'
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (account.length !== 1) throw new Error("ACCOUNT_UNAVAILABLE");
        const data = {
          language: input.language === "vi" ? ("VI" as const) : ("EN" as const),
          timezone: input.timezone,
          applicationUpdatesEmail: input.emailNotifications.application_updates,
          jobRecommendationsEmail: input.emailNotifications.job_recommendations,
          accountSecurityEmail: input.emailNotifications.account_security,
        };
        return tx.accountPreferences.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data,
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ACCOUNT_UNAVAILABLE") {
        throw error;
      }
      throw new AccountPreferencesPersistenceError();
    }
  }
}
