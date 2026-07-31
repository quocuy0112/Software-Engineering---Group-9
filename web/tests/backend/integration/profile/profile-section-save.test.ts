import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { SaveProfileSectionService } from "@/backend/services/profile/save-profile-section";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let other: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
const service = new SaveProfileSectionService();

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("section-owner");
  other = await createProfileDatabaseAccount("section-other");
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([owner.userId, other.userId]);
  await prisma.skill.deleteMany({
    where: { normalizedName: { startsWith: "section-skill-" } },
  });
});

describe("section-scoped profile saves", () => {
  it("creates, reorders, deletes, and increments exactly once per section", async () => {
    const basics = await service.execute(owner.userId, {
      section: "basics",
      baseRevision: 0,
      basics: {
        headline: "Platform Engineer",
        summary: "Builds reliable systems.",
        phone: "+84 912 345 678",
        location: "Hồ Chí Minh",
      },
    });
    expect(basics.profile.revision).toBe(1);
    const created = await service.execute(owner.userId, {
      section: "experience",
      baseRevision: 1,
      experience: [
        {
          title: "Engineer",
          company: "One",
          description: null,
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          current: false,
        },
        {
          title: "Senior Engineer",
          company: "Two",
          description: "Current role",
          startDate: "2025-01-01",
          endDate: null,
          current: true,
        },
      ],
    });
    expect(created.profile.revision).toBe(2);
    expect(created.profile.experience).toHaveLength(2);
    const reversed = [...created.profile.experience].reverse();
    const reordered = await service.execute(owner.userId, {
      section: "experience",
      baseRevision: 2,
      experience: reversed,
    });
    expect(reordered.profile.revision).toBe(3);
    expect(reordered.profile.experience.map(({ id }) => id)).toEqual(
      reversed.map(({ id }) => id),
    );
    const deleted = await service.execute(owner.userId, {
      section: "experience",
      baseRevision: 3,
      experience: [reordered.profile.experience[0]!],
    });
    expect(deleted.profile.revision).toBe(4);
    expect(deleted.profile.experience).toHaveLength(1);
    expect(deleted.profile.basics).toEqual(basics.profile.basics);
  });

  it("saves every structured section without changing unselected sections", async () => {
    const before = await new GetProfileAggregateService().execute(owner.userId);
    const skills = await service.execute(owner.userId, {
      section: "skills",
      baseRevision: before.revision,
      skills: [
        { label: "Section Skill Alpha" },
        { label: "Section Skill Beta" },
      ],
    });
    const education = await service.execute(owner.userId, {
      section: "education",
      baseRevision: skills.profile.revision,
      education: [
        {
          institution: "University",
          degree: "BSc",
          field: "Software Engineering",
          startDate: "2020-01-01",
          endDate: "2024-01-01",
          current: false,
        },
      ],
    });
    const links = await service.execute(owner.userId, {
      section: "socialLinks",
      baseRevision: education.profile.revision,
      socialLinks: [
        { url: "https://github.com/example" },
        { url: "https://www.linkedin.com/in/example" },
      ],
    });
    expect(links.profile.skills.map(({ label }) => label)).toEqual([
      "Section Skill Alpha",
      "Section Skill Beta",
    ]);
    expect(links.profile.education).toHaveLength(1);
    expect(links.profile.socialLinks).toHaveLength(2);
    expect(links.profile.basics).toEqual(before.basics);
    expect(links.profile.experience).toEqual(before.experience);
  });

  it("rolls back the full section when any owned child check fails", async () => {
    const foreign = await service.execute(other.userId, {
      section: "education",
      baseRevision: 0,
      education: [
        {
          institution: "Foreign University",
          degree: "BSc",
          field: null,
          startDate: "2020-01-01",
          endDate: "2024-01-01",
          current: false,
        },
      ],
    });
    const before = await new GetProfileAggregateService().execute(owner.userId);
    await expect(
      service.execute(owner.userId, {
        section: "education",
        baseRevision: before.revision,
        education: [
          ...before.education,
          {
            ...foreign.profile.education[0]!,
            institution: "Forged University",
          },
        ],
      }),
    ).rejects.toThrow("PROFILE_ITEM_NOT_OWNED");
    expect(
      await new GetProfileAggregateService().execute(owner.userId),
    ).toEqual(before);
  });

  it("rejects caps without changing the aggregate revision", async () => {
    const before = await new GetProfileAggregateService().execute(owner.userId);
    await expect(
      service.execute(owner.userId, {
        section: "skills",
        baseRevision: before.revision,
        skills: Array.from({ length: 51 }, (_, index) => ({
          label: `Section Skill ${index}`,
        })),
      }),
    ).rejects.toThrow();
    expect(
      (await new GetProfileAggregateService().execute(owner.userId)).revision,
    ).toBe(before.revision);
  });
});
