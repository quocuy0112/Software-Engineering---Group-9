import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import type { ProfileSectionMutation } from "@/shared/contracts/account/profile";
import { PrismaSkillCatalogRepository } from "./prisma-skill-catalog-repository";

type LockedProfile = { id: string; revision: number };

async function assertOwnedIds(
  existingIds: string[],
  suppliedIds: Array<string | undefined>,
): Promise<void> {
  const expected = suppliedIds.filter((id): id is string => Boolean(id));
  if (
    new Set(expected).size !== expected.length ||
    expected.some((id) => !existingIds.includes(id))
  ) {
    throw new Error("PROFILE_ITEM_NOT_OWNED");
  }
}

export class PrismaProfileCommandRepository {
  constructor(private readonly skills = new PrismaSkillCatalogRepository()) {}

  async saveSection(
    userId: string,
    mutation: ProfileSectionMutation,
  ): Promise<{ revision: number; conflictApplied: boolean }> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LockedProfile[]>`
        SELECT profile."id", profile."revision"
        FROM "CandidateProfile" profile
        INNER JOIN "CandidateIdentity" identity
          ON identity."userId" = profile."candidateUserId"
        INNER JOIN "user" account
          ON account."id" = identity."userId"
        WHERE profile."candidateUserId" = ${userId}
          AND account."state" = 'ACTIVE'
        FOR UPDATE OF profile
      `;
      const profile = locked[0];
      if (!profile) throw new Error("PROFILE_NOT_AVAILABLE");
      const conflictApplied = profile.revision !== mutation.baseRevision;

      if (mutation.section === "visibility") {
        const existing = await tx.candidateProfileVisibility.findUnique({
          where: { candidateUserId: userId },
          select: { version: true },
        });
        const candidateSections = [...new Set(mutation.visibility.candidateSections)];
        const recruiterSections = [...new Set(mutation.visibility.recruiterSections)];
        await tx.candidateProfileVisibility.upsert({
          where: { candidateUserId: userId },
          create: {
            candidateUserId: userId,
            discoverableByExactId: mutation.visibility.discoverableByExactId,
            candidateSections,
            recruiterSections,
            version: 1,
          },
          update: {
            discoverableByExactId: mutation.visibility.discoverableByExactId,
            candidateSections,
            recruiterSections,
            version: { increment: existing ? 1 : 0 },
          },
        });
      } else if (mutation.section === "basics") {
        await tx.candidateProfile.update({
          where: { id: profile.id },
          data: mutation.basics,
        });
      } else if (mutation.section === "about") {
        await tx.candidateProfile.update({
          where: { id: profile.id },
          data: {
            dateOfBirth: mutation.about.dateOfBirth
              ? new Date(`${mutation.about.dateOfBirth}T00:00:00.000Z`)
              : null,
            preferredName: mutation.about.preferredName,
            interests: mutation.about.interests,
            bio: mutation.about.bio,
          },
        });
      } else if (mutation.section === "experience") {
        const existing = await tx.profileExperience.findMany({
          where: { profileId: profile.id },
          select: { id: true },
        });
        await assertOwnedIds(
          existing.map(({ id }) => id),
          mutation.experience.map(({ id }) => id),
        );
        await tx.profileExperience.deleteMany({
          where: { profileId: profile.id },
        });
        if (mutation.experience.length) {
          await tx.profileExperience.createMany({
            data: mutation.experience.map((entry, position) => ({
              id: entry.id ?? randomUUID(),
              profileId: profile.id,
              title: entry.title,
              company: entry.company,
              description: entry.description,
              startDate: new Date(`${entry.startDate}T00:00:00.000Z`),
              endDate: entry.endDate
                ? new Date(`${entry.endDate}T00:00:00.000Z`)
                : null,
              isCurrent: entry.current,
              position,
            })),
          });
        }
      } else if (mutation.section === "education") {
        const existing = await tx.profileEducation.findMany({
          where: { profileId: profile.id },
          select: { id: true },
        });
        await assertOwnedIds(
          existing.map(({ id }) => id),
          mutation.education.map(({ id }) => id),
        );
        await tx.profileEducation.deleteMany({
          where: { profileId: profile.id },
        });
        if (mutation.education.length) {
          await tx.profileEducation.createMany({
            data: mutation.education.map((entry, position) => ({
              id: entry.id ?? randomUUID(),
              profileId: profile.id,
              institution: entry.institution,
              degree: entry.degree,
              field: entry.field,
              startDate: new Date(`${entry.startDate}T00:00:00.000Z`),
              endDate: entry.endDate
                ? new Date(`${entry.endDate}T00:00:00.000Z`)
                : null,
              isCurrent: entry.current,
              position,
            })),
          });
        }
      } else if (mutation.section === "socialLinks") {
        const existing = await tx.socialLink.findMany({
          where: { profileId: profile.id },
          select: { id: true },
        });
        await assertOwnedIds(
          existing.map(({ id }) => id),
          mutation.socialLinks.map(({ id }) => id),
        );
        await tx.socialLink.deleteMany({ where: { profileId: profile.id } });
        if (mutation.socialLinks.length) {
          await tx.socialLink.createMany({
            data: mutation.socialLinks.map((entry, position) => ({
              id: entry.id ?? randomUUID(),
              profileId: profile.id,
              url: entry.url,
              normalizedUrl: entry.url,
              position,
            })),
          });
        }
      } else {
        const resolved = [];
        for (const skill of mutation.skills) {
          resolved.push(await this.skills.resolve(tx, skill));
        }
        await tx.candidateProfileSkill.deleteMany({
          where: { profileId: profile.id },
        });
        if (resolved.length) {
          await tx.candidateProfileSkill.createMany({
            data: resolved.map((skill, position) => ({
              profileId: profile.id,
              skillId: skill.id,
              displayName: skill.displayName,
              position,
            })),
          });
        }
      }

      const updated = await tx.candidateProfile.update({
        where: { id: profile.id },
        data: { revision: { increment: 1 } },
        select: { revision: true },
      });
      return { revision: updated.revision, conflictApplied };
    });
  }
}
