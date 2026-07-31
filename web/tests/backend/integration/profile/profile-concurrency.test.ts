import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { SaveProfileSectionService } from "@/backend/services/profile/save-profile-section";

let first: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let second: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;

beforeAll(async () => {
  first = await createProfileDatabaseAccount("concurrency-first");
  second = await createProfileDatabaseAccount("concurrency-second");
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([first.userId, second.userId]);
  await prisma.skill.deleteMany({
    where: { normalizedName: "điện toán đám mây" },
  });
});

describe("profile concurrency", () => {
  it("applies valid stale writes and reports the visible conflict", async () => {
    const service = new SaveProfileSectionService();
    const results = await Promise.all([
      service.execute(first.userId, {
        section: "basics",
        baseRevision: 0,
        basics: {
          headline: "Writer A",
          summary: null,
          phone: null,
          location: null,
        },
      }),
      service.execute(first.userId, {
        section: "basics",
        baseRevision: 0,
        basics: {
          headline: "Writer B",
          summary: null,
          phone: null,
          location: null,
        },
      }),
    ]);
    expect(
      results.map(({ conflictApplied }) => conflictApplied).sort(),
    ).toEqual([false, true]);
    expect(
      results.find(({ conflictApplied }) => conflictApplied)?.message,
    ).toMatch(/another session|newer/i);
    const final = await new GetProfileAggregateService().execute(first.userId);
    expect(final.revision).toBe(2);
    expect(["Writer A", "Writer B"]).toContain(final.basics.headline);
  });

  it("converges normalized concurrent skill upserts to one catalog row", async () => {
    const service = new SaveProfileSectionService();
    const [left, right] = await Promise.all([
      service.execute(first.userId, {
        section: "skills",
        baseRevision: 2,
        skills: [{ label: "Điện toán   đám mây" }],
      }),
      service.execute(second.userId, {
        section: "skills",
        baseRevision: 0,
        skills: [{ label: " ĐIỆN TOÁN ĐÁM MÂY " }],
      }),
    ]);
    expect(
      await prisma.skill.count({
        where: { normalizedName: "điện toán đám mây" },
      }),
    ).toBe(1);
    expect(left.profile.skills[0]?.id).toBe(right.profile.skills[0]?.id);
    const stableId = left.profile.skills[0]?.id;
    const savedAgain = await service.execute(first.userId, {
      section: "skills",
      baseRevision: left.profile.revision,
      skills: [{ id: stableId, label: "Điện toán đám mây" }],
    });
    expect(savedAgain.profile.skills[0]?.id).toBe(stableId);
  });
});
