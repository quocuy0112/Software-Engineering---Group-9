import "server-only";
import { prisma } from "@/backend/database/prisma";

export interface SystemReadinessRepository {
  schemaReady(): Promise<boolean>;
}

export class PrismaSystemReadinessRepository implements SystemReadinessRepository {
  async schemaReady(): Promise<boolean> {
    const [result] = await prisma.$queryRaw<{ ready: boolean }[]>`
      SELECT (
        to_regclass('public.user') IS NOT NULL
        AND to_regclass('public."CandidateProfile"') IS NOT NULL
        AND to_regclass('public."AccountPreferences"') IS NOT NULL
        AND to_regclass('public."EmailChangeRequest"') IS NOT NULL
        AND to_regclass('public."PasswordChangeOperation"') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "_prisma_migrations"
          WHERE "migration_name" = '008_allow_outbox_retention_fk_cleanup'
            AND "finished_at" IS NOT NULL
            AND "rolled_back_at" IS NULL
        )
      ) AS "ready"
    `;
    return result?.ready === true;
  }
}
