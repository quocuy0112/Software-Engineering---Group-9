import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("canonical application tracking migration", () => {
  it("runs after application metadata exists and then backfills scoring", async () => {
    const metadataSql = await readFile(
      resolve(
        process.cwd(),
        "prisma/migrations/20260807081414_smarthire/migration.sql",
      ),
      "utf8",
    );
    const trackingSql = await readFile(
      resolve(
        process.cwd(),
        "prisma/migrations/20260808090000_canonical_application_tracking/migration.sql",
      ),
      "utf8",
    );

    for (const column of [
      "cvFileRef",
      "contactSnapshot",
      "aiAnalysisConsent",
      "aiMatchScore",
    ]) {
      expect(
        metadataSql,
        `${column} is created by metadata migration`,
      ).toContain(`ADD COLUMN "${column}"`);
      expect(trackingSql, `${column} is not created twice`).not.toContain(
        `ADD COLUMN "${column}"`,
      );
    }
    expect(metadataSql).toContain(
      'CREATE INDEX "JobApplication_candidateUserId_aiAnalysisConsent_idx"',
    );
    expect(trackingSql).toContain(
      'UPDATE "JobApplication"\nSET "scoringStatus"',
    );
    expect(
      "20260807081414_smarthire".localeCompare(
        "20260808090000_canonical_application_tracking",
      ),
    ).toBeLessThan(0);
  });
});
