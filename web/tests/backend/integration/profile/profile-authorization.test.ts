import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { SaveProfileSectionService } from "@/backend/services/profile/save-profile-section";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let other: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let inactive: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("authorization-owner");
  other = await createProfileDatabaseAccount("authorization-other");
  inactive = await createProfileDatabaseAccount("authorization-inactive", {
    state: "SUSPENDED",
  });
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([
    owner.userId,
    other.userId,
    inactive.userId,
  ]);
});

describe("profile aggregate authorization", () => {
  it("returns the canonical empty aggregate only for the requested owner", async () => {
    await expect(
      new GetProfileAggregateService().execute(owner.userId),
    ).resolves.toEqual({
      revision: 0,
      empty: true,
      basics: { headline: null, summary: null, phone: null, location: null },
      skills: [],
      experience: [],
      education: [],
      socialLinks: [],
    });
  });

  it("never accepts forged owner identifiers in a mutation", async () => {
    await expect(
      new SaveProfileSectionService().execute(owner.userId, {
        section: "basics",
        baseRevision: 0,
        userId: other.userId,
        basics: {
          headline: "Forged",
          summary: null,
          phone: null,
          location: null,
        },
      } as never),
    ).rejects.toThrow(/VALIDATION|unsupported/i);
    expect(
      (await new GetProfileAggregateService().execute(other.userId)).basics
        .headline,
    ).toBeNull();
  });

  it("rejects inactive accounts before profile access", async () => {
    await expect(
      new GetProfileAggregateService().execute(inactive.userId),
    ).rejects.toThrow("PROFILE_NOT_AVAILABLE");
    await expect(
      new SaveProfileSectionService().execute(inactive.userId, {
        section: "basics",
        baseRevision: 0,
        basics: {
          headline: "Denied",
          summary: null,
          phone: null,
          location: null,
        },
      }),
    ).rejects.toThrow("PROFILE_NOT_AVAILABLE");
  });

  it("makes foreign and nonexistent child IDs indistinguishable", async () => {
    const foreign = await new SaveProfileSectionService().execute(
      other.userId,
      {
        section: "experience",
        baseRevision: 0,
        experience: [
          {
            title: "Foreign",
            company: "Other",
            description: null,
            startDate: "2025-01-01",
            endDate: null,
            current: true,
          },
        ],
      },
    );
    const foreignId = foreign.profile.experience[0]?.id ?? "";
    const mutation = (id: string) => ({
      section: "experience" as const,
      baseRevision: 0,
      experience: [
        {
          id,
          title: "Attempt",
          company: "Owner",
          description: null,
          startDate: "2025-01-01",
          endDate: null,
          current: true,
        },
      ],
    });
    const service = new SaveProfileSectionService();
    await expect(
      service.execute(owner.userId, mutation(foreignId)),
    ).rejects.toThrow("PROFILE_ITEM_NOT_OWNED");
    await expect(
      service.execute(owner.userId, mutation("missing-child")),
    ).rejects.toThrow("PROFILE_ITEM_NOT_OWNED");
  });
});
