import "server-only";
import {
  candidateProfileSchema,
  profileVisibilitySchema,
  type CandidateProfileContract,
} from "@/shared/contracts/account/profile";
import { PrismaProfileQueryRepository } from "@/backend/repositories/profile/prisma-profile-query-repository";

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export class GetProfileAggregateService {
  constructor(
    private readonly repository = new PrismaProfileQueryRepository(),
  ) {}

  async execute(userId: string): Promise<CandidateProfileContract> {
    const row = await this.repository.findOwned(userId);
    if (!row) throw new Error("PROFILE_NOT_AVAILABLE");
    const profile = {
      revision: row.revision,
      empty:
        !row.headline &&
        !row.summary &&
        !row.phone &&
        !row.location &&
        row.skills.length === 0 &&
        row.experiences.length === 0 &&
        row.education.length === 0 &&
        row.socialLinks.length === 0,
      basics: {
        headline: row.headline,
        summary: row.summary,
        phone: row.phone,
        location: row.location,
      },
      about: {
        dateOfBirth: row.dateOfBirth ? dateOnly(row.dateOfBirth) : null,
        preferredName: row.preferredName,
        interests: row.interests,
        bio: row.bio,
      },
      skills: row.skills.map(({ skillId, displayName }) => ({
        id: skillId,
        label: displayName,
      })),
      experience: row.experiences.map((entry) => ({
        id: entry.id,
        title: entry.title,
        company: entry.company,
        description: entry.description,
        startDate: dateOnly(entry.startDate),
        endDate: entry.endDate ? dateOnly(entry.endDate) : null,
        current: entry.isCurrent,
      })),
      education: row.education.map((entry) => ({
        id: entry.id,
        institution: entry.institution,
        degree: entry.degree,
        field: entry.field,
        startDate: dateOnly(entry.startDate),
        endDate: entry.endDate ? dateOnly(entry.endDate) : null,
        current: entry.isCurrent,
      })),
      socialLinks: row.socialLinks.map((entry) => ({
        id: entry.id,
        url: entry.url,
      })),
      visibility: row.candidate.profileVisibility
        ? profileVisibilitySchema.parse({
            discoverableByExactId:
              row.candidate.profileVisibility.discoverableByExactId,
            candidateSections: row.candidate.profileVisibility.candidateSections,
            recruiterSections: row.candidate.profileVisibility.recruiterSections,
            version: row.candidate.profileVisibility.version,
          })
        : {
            discoverableByExactId: false,
            candidateSections: [],
            recruiterSections: [],
            version: 0,
          },
    };
    return candidateProfileSchema.parse(profile);
  }
}
