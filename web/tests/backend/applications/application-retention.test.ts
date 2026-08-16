import { describe, expect, it } from "vitest";
import { applicationClock, legalHoldFixture } from "../../helpers/application-fixture";

describe("application retention fixtures", () => {
  it("uses a controlled clock and keeps legal-hold metadata content-free", () => {
    const now = applicationClock();
    const hold = legalHoldFixture();
    expect(now.toISOString()).toBe("2026-08-15T00:00:00.000Z");
    expect(hold).toMatchObject({ purposeCode: "COMPLAINT_REVIEW", releasedAt: null });
    expect(hold).not.toHaveProperty("cvText");
    expect(hold).not.toHaveProperty("coverLetter");
  });
});
