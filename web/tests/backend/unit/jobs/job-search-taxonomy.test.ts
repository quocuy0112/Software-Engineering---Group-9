import { describe, expect, it } from "vitest";
import {
  buildCatalogJobSearchTaxonomy,
  buildJobSearchTaxonomy,
  listJobSearchTaxonomy,
} from "@/backend/services/jobs/job-search-taxonomy";
import { buildJobReviewSnapshot } from "@/../tests/helpers/job-post-reviews/job-post-review-fixtures";

function row(snapshot: ReturnType<typeof buildJobReviewSnapshot>) {
  return {
    title: snapshot.title,
    location: [snapshot.location.district, snapshot.location.city]
      .filter(Boolean)
      .join(", "),
    company: { industry: snapshot.industry },
    reviewAggregate: { approvedVersion: { snapshot } },
  };
}

describe("job search taxonomy", () => {
  it("retains all 29 catalog industries and their open-role counts", async () => {
    const taxonomy = await listJobSearchTaxonomy();

    expect(taxonomy.industries).toHaveLength(29);
    expect(taxonomy.industries.map(({ code }) => code).sort()).toEqual(
      Array.from(
        { length: 29 },
        (_, index) => `r${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(taxonomy.industries).toContainEqual(
      expect.objectContaining({
        code: "r01",
        name: "Sales & Business Development",
        count: expect.any(Number),
      }),
    );
    expect(taxonomy.industries).toContainEqual(
      expect.objectContaining({
        code: "r03",
        name: "Information Technology (IT)",
        count: expect.any(Number),
      }),
    );
    expect(taxonomy.industries).toContainEqual(
      expect.objectContaining({
        code: "r28",
        name: "General Labor & Drivers",
        count: expect.any(Number),
      }),
    );
    expect(taxonomy.industries).toContainEqual(
      expect.objectContaining({
        code: "r29",
        name: "Other",
        count: expect.any(Number),
      }),
    );
  });

  it("precomputes a counted industry, sub-industry, title, and location tree", () => {
    const b2b = {
      industry: "Sales & Business Development",
      industryCode: "r01",
      subIndustry: "B2B Sales",
      categoryIds: ["r01-b2b-sales"],
      categoryFamily: "r01",
    };
    const taxonomy = buildJobSearchTaxonomy([
      row(buildJobReviewSnapshot({ ...b2b, title: "Key Account Manager" })),
      row(buildJobReviewSnapshot({ ...b2b, title: "Key Account Manager" })),
      row(
        buildJobReviewSnapshot({
          ...b2b,
          title: "Account Executive",
          location: {
            city: "Da Nang",
            district: "Hai Chau",
            isNationwideRemote: false,
          },
        }),
      ),
    ]);

    expect(taxonomy.industries).toEqual([
      expect.objectContaining({ code: "r01", count: 3 }),
    ]);
    expect(taxonomy.industries[0]?.subIndustries[0]).toMatchObject({
      name: "B2B Sales",
      count: 3,
      titles: [
        {
          name: "Key Account Manager",
          categoryIds: ["r01-b2b-sales"],
          count: 2,
        },
        { name: "Account Executive", categoryIds: ["r01-b2b-sales"], count: 1 },
      ],
    });
    expect(taxonomy.locations).toContainEqual(
      expect.objectContaining({ label: "Da Nang", value: "Da Nang", count: 1 }),
    );
    expect(taxonomy.locations).toContainEqual(
      expect.objectContaining({
        label: "Da Nang · Hai Chau",
        value: "Hai Chau, Da Nang",
      }),
    );
    expect(taxonomy.locationGroups).toContainEqual({
      city: "Da Nang",
      count: 1,
      districts: [{ name: "Hai Chau", count: 1 }],
    });
  });

  it("counts only catalog jobs whose application deadline is still open", () => {
    const taxonomy = buildCatalogJobSearchTaxonomy(
      [
        {
          id: "open-job",
          industry: "Information Technology (IT)",
          industryCode: "r03",
          subIndustry: "Software Development",
          title: "Backend Developer",
          categoryIds: ["r03-software-development"],
          status: "active",
          applyDeadline: "2026-08-26T00:00:00.000Z",
          location: { city: "Hanoi", district: "Ba Dinh" },
        },
        {
          id: "expired-job",
          industry: "Information Technology (IT)",
          industryCode: "r03",
          subIndustry: "Software Development",
          title: "Expired Developer",
          categoryIds: ["r03-software-development"],
          status: "active",
          applyDeadline: "2026-08-24T00:00:00.000Z",
          location: { city: "Hanoi", district: "Ba Dinh" },
        },
        {
          id: "closed-job",
          industry: "Information Technology (IT)",
          industryCode: "r03",
          subIndustry: "Software Development",
          title: "Closed Developer",
          categoryIds: ["r03-software-development"],
          status: "closed",
          applyDeadline: "2026-08-26T00:00:00.000Z",
          location: { city: "Hanoi", district: "Ba Dinh" },
        },
      ],
      new Date("2026-08-25T00:00:00.000Z"),
    );

    expect(taxonomy.locationGroups).toContainEqual({
      city: "Hanoi",
      count: 1,
      districts: [{ name: "Ba Dinh", count: 1 }],
    });
    expect(taxonomy.industries).toEqual([
      expect.objectContaining({ code: "r03", count: 1 }),
    ]);
  });
});
