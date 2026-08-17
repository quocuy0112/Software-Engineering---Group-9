import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("job-scoped pipeline stage route", () => {
  it("uses the active-account, same-origin, CSRF, idempotency and strict shared boundary", async () => {
    const route = await import("@/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/stage/route");
    expect(route.PATCH).toBeTypeOf("function");
    const source = readFileSync("src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/stage/route.ts", "utf8");
    expect(source).toContain("requireAccountRequest");
    expect(source).toContain("mutation: true");
    expect(source).toContain("idempotency-key");
    expect(source).toContain("stageTransitionCommandSchema");
  });
});
