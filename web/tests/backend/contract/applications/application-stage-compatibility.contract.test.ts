import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("application stage entry-point parity", () => {
  it("keeps decision service as thin adapters over ApplicationStageService", () => {
    const source = readFileSync("src/backend/applications/services/recruiter-application-decision-service.ts", "utf8");
    expect(source).toContain("ApplicationStageService");
    expect(source).not.toContain("applicationStageEvent.create");
    expect(source).not.toContain("createInAppNotification");
    expect(source).not.toContain("$transaction");
  });
  it.each(["stage", "decisions/interview", "decisions/reject"])("secures the legacy %s handler with the active account mutation boundary", (suffix) => {
    const source = readFileSync(`src/app/api/recruiter/applications/[applicationId]/${suffix}/route.ts`, "utf8");
    expect(source).toContain("requireAccountRequest");
    expect(source).toContain("mutation: true");
    expect(source).toContain("idempotency-key");
  });
});
