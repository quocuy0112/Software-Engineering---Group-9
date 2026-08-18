import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("application stage notification privacy", () => {
  it("does not put private notes, raw idempotency keys, or tenant identifiers in candidate payloads", () => {
    const source = readFileSync("src/backend/services/jobs/application-stage-service.ts", "utf8");
    const start = source.lastIndexOf("createInAppNotification");
    const end = source.indexOf("await new PrismaAuditRepository", start);
    const delivery = source.slice(start, end);
    expect(delivery).not.toContain("internalNote");
    expect(delivery).not.toContain("idempotencyKey.trim");
    expect(delivery).not.toContain("companyId");
    expect(delivery).not.toContain("requestedJobId");
  });
});
