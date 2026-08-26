import { describe, expect, it } from "vitest";
import {
  hasReachedApplicationLimit,
  isActiveApplication,
  MAX_APPLICATION_ATTEMPTS,
} from "@/backend/services/jobs/application-attempt-policy";

describe("application attempt policy", () => {
  it("scopes active eligibility to the individual application state", () => {
    expect(
      isActiveApplication({ stage: "APPLIED", withdrawalOutcome: null }),
    ).toBe(true);
    expect(
      isActiveApplication({
        stage: "APPLIED",
        withdrawalOutcome: "CANDIDATE_WITHDRAWN",
      }),
    ).toBe(false);
    expect(
      isActiveApplication({ stage: "REJECTED", withdrawalOutcome: null }),
    ).toBe(false);
  });

  it("keeps the fifth attempt available but blocks the sixth", () => {
    expect(hasReachedApplicationLimit(MAX_APPLICATION_ATTEMPTS - 1)).toBe(
      false,
    );
    expect(hasReachedApplicationLimit(MAX_APPLICATION_ATTEMPTS)).toBe(true);
    expect(hasReachedApplicationLimit(MAX_APPLICATION_ATTEMPTS + 1)).toBe(true);
  });
});
