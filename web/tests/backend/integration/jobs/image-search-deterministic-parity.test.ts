import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  JobDiscoveryService,
  parseJobSearchCriteria,
} from "@/backend/services/jobs/job-discovery-service";
import { applyImageSearchIntent } from "@/frontend/features/jobs/image-search/client/apply-image-search-intent";
import type { ManualSearchContext } from "@/shared/contracts/jobs/image-search";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";

const databaseAvailable = Boolean(process.env.DATABASE_URL);

const empty: ManualSearchContext = {
  q: "",
  location: "",
  employmentType: [],
  experienceLevel: [],
  workArrangement: [],
  skills: [],
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "VND",
  salaryPeriod: "MONTH",
  postedWithinDays: null,
  sort: "RELEVANCE",
};

const intent: SearchIntent = {
  schemaVersion: "job-search-intent-v1",
  language: "VI",
  warnings: [],
  proposals: [
    {
      id: "q",
      field: "q",
      stringValue: "lap trinh vien",
      numberValue: null,
      stringValues: [],
      confidence: 0.99,
      basis: "EXPLICIT",
      evidence: [
        { startCodePoint: 0, endCodePoint: 15, text: "lap trinh vien" },
      ],
      selected: true,
      selectionReason: "AUTO_EXPLICIT",
    },
    {
      id: "location",
      field: "location",
      stringValue: "ho chi minh",
      numberValue: null,
      stringValues: [],
      confidence: 0.99,
      basis: "NORMALIZED",
      evidence: [{ startCodePoint: 16, endCodePoint: 27, text: "ho chi minh" }],
      selected: true,
      selectionReason: "AUTO_NORMALIZED",
    },
    ...(["FULL_TIME", "MID", "HYBRID"] as const).map((value, index) => ({
      id: `enum-${index}`,
      field: (
        ["employmentType", "experienceLevel", "workArrangement"] as const
      )[index]!,
      stringValue: null,
      numberValue: null,
      stringValues: [value],
      confidence: 0.99,
      basis: "NORMALIZED" as const,
      evidence: [
        { startCodePoint: 28 + index, endCodePoint: 29 + index, text: "x" },
      ],
      selected: true,
      selectionReason: "AUTO_NORMALIZED" as const,
    })),
    {
      id: "skills",
      field: "skills",
      stringValue: null,
      numberValue: null,
      stringValues: ["TypeScript"],
      confidence: 0.99,
      basis: "EXPLICIT",
      evidence: [{ startCodePoint: 32, endCodePoint: 42, text: "TypeScript" }],
      selected: true,
      selectionReason: "AUTO_EXPLICIT",
    },
  ],
};

function rawFromImageUrl(url: string) {
  const parameters = new URL(url, "http://localhost").searchParams;
  const array = (name: string) => parameters.getAll(name);
  return {
    q: parameters.get("q") ?? undefined,
    location: parameters.get("location") ?? undefined,
    employmentType: array("employmentType"),
    experienceLevel: array("experienceLevel"),
    workArrangement: array("workArrangement"),
    skills: array("skills"),
    salaryMin: parameters.get("salaryMin") ?? undefined,
    salaryMax: parameters.get("salaryMax") ?? undefined,
    salaryCurrency: parameters.get("salaryCurrency") ?? undefined,
    salaryPeriod: parameters.get("salaryPeriod") ?? undefined,
    postedWithinDays: parameters.get("postedWithinDays") ?? undefined,
    sort: parameters.get("sort") ?? undefined,
  };
}

describe.skipIf(!databaseAvailable)(
  "manual/image deterministic search parity",
  () => {
    let fixture: Awaited<
      ReturnType<
        typeof import("../../../helpers/job-board-database-fixture").createJobBoardDatabaseFixture
      >
    >;

    beforeAll(async () => {
      fixture = await (
        await import("../../../helpers/job-board-database-fixture")
      ).createJobBoardDatabaseFixture("image-parity");
    });

    afterAll(async () => {
      if (fixture)
        await (
          await import("../../../helpers/job-board-database-fixture")
        ).deleteJobBoardDatabaseFixture(fixture);
    });

    it("normalizes, orders, paginates, and authorizes image criteria through Feature 003", async () => {
      const manual = {
        q: "lap trinh vien",
        location: "ho chi minh",
        employmentType: ["FULL_TIME"],
        experienceLevel: ["MID"],
        workArrangement: ["HYBRID"],
        skills: ["TypeScript"],
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        sort: "RELEVANCE",
      };
      const image = rawFromImageUrl(applyImageSearchIntent(empty, intent));
      expect(parseJobSearchCriteria(image)).toEqual(
        parseJobSearchCriteria(manual),
      );

      const service = new JobDiscoveryService();
      const [manualResult, imageResult] = await Promise.all([
        service.search(manual, { kind: "visitor" }, fixture.now),
        service.search(image, { kind: "visitor" }, fixture.now),
      ]);
      expect(imageResult).toEqual(manualResult);
      expect(
        imageResult.items.filter((item) => item.id === fixture.jobs.active.id),
      ).toHaveLength(1);
      expect(
        imageResult.items.some((item) => item.id === fixture.jobs.closed.id),
      ).toBe(false);
    });
  },
);
