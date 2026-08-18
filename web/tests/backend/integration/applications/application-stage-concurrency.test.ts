import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stage concurrency boundary", () => {
  it("uses one serializable compare-and-set and application/version uniqueness", () => {
    const service = readFileSync("src/backend/services/jobs/application-stage-service.ts", "utf8");
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(service).toContain('isolationLevel: "Serializable"');
    expect(service).toContain("updated.count !== 1");
    expect(service).toContain("APPLICATION_STAGE_CONFLICT");
    expect(schema).toContain("@@unique([applicationId, applicationVersion])");
    expect(schema).toContain("@@unique([applicationId, idempotencyKey])");
  });
});
