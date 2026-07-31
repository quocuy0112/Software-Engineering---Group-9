import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { normalizeProfileSkillName } from "@/backend/domain/profile/skill-name";

type SkillClient =
  | Pick<typeof prisma, "skill" | "$queryRaw">
  | Prisma.TransactionClient;

export class PrismaSkillCatalogRepository {
  async resolve(
    db: SkillClient,
    input: { id?: string; label: string },
  ): Promise<{ id: string; displayName: string; normalizedName: string }> {
    const normalized = normalizeProfileSkillName(input.label);
    if (input.id) {
      const existing = await db.skill.findUnique({ where: { id: input.id } });
      if (!existing || existing.normalizedName !== normalized.normalizedName) {
        throw new Error("PROFILE_ITEM_NOT_OWNED");
      }
      return {
        id: existing.id,
        displayName: normalized.displayName,
        normalizedName: existing.normalizedName,
      };
    }
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "Skill" (
        "id",
        "name",
        "normalizedName",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${normalized.displayName},
        ${normalized.normalizedName},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("normalizedName")
      DO UPDATE SET "normalizedName" = EXCLUDED."normalizedName"
      RETURNING "id"
    `;
    const skill = rows[0];
    if (!skill) throw new Error("SKILL_CATALOG_WRITE_FAILED");
    return { id: skill.id, ...normalized };
  }

  async suggest(
    normalizedQuery: string,
    limit: number,
  ): Promise<Array<{ id: string; label: string }>> {
    const rows = await prisma.skill.findMany({
      where: { normalizedName: { contains: normalizedQuery } },
      orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, name: true },
    });
    return rows.map(({ id, name }) => ({ id, label: name }));
  }
}
