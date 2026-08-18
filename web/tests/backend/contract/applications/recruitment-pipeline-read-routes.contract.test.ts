import { describe, expect, it } from "vitest";

describe("pipeline read routes", () => {
  it("exports metadata and stage GET handlers", async () => {
    const metadata = await import("@/app/api/recruiter/jobs/[jobId]/applications/pipeline/route");
    const page = await import("@/app/api/recruiter/jobs/[jobId]/applications/pipeline/[stage]/route");
    expect(metadata.GET).toBeTypeOf("function");
    expect(page.GET).toBeTypeOf("function");
  });
});
