import "server-only";
import { prisma } from "@/backend/database/prisma";
import { PlainTextNormalizer } from "@/backend/security/plain-text/plain-text-normalizer";
import { PrismaSkillCatalogRepository } from "@/backend/repositories/profile/prisma-skill-catalog-repository";
import {
  skillSuggestionsQuerySchema,
  skillSuggestionsResponseSchema,
} from "@/shared/contracts/account/profile";
import { normalizeSkillName } from "./profile-validation";

export class SuggestProfileSkillsService {
  constructor(
    private readonly repository = new PrismaSkillCatalogRepository(),
  ) {}

  async execute(
    userId: string,
    input: unknown,
  ): Promise<{ skills: Array<{ id: string; label: string }> }> {
    const account = await prisma.userAccount.findUnique({
      where: { id: userId },
      select: { state: true },
    });
    if (account?.state !== "ACTIVE") throw new Error("PROFILE_NOT_AVAILABLE");
    const query = skillSuggestionsQuerySchema.parse(input);
    const normalized = new PlainTextNormalizer().normalize(query.query, {
      field: "query",
      maxCodePoints: 80,
      required: true,
    }).value;
    const normalizedQuery = normalizeSkillName(normalized ?? "").normalizedName;
    return skillSuggestionsResponseSchema.parse({
      skills: await this.repository.suggest(normalizedQuery, query.limit),
    });
  }
}
