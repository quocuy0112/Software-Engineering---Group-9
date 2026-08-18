import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("rejection private note privacy", () => {
  it("persists the private note only on the internal event and excludes it from candidate/audit/notification payloads", () => {
    const source = readFileSync("src/backend/services/jobs/application-stage-service.ts", "utf8");
    expect(source).toContain("internalNoteEncrypted: command.internalNote");
    const notificationBlock = source.slice(source.lastIndexOf("createInAppNotification"), source.indexOf("const emailUpdatesEnabled"));
    expect(notificationBlock).not.toContain("internalNote");
    const auditBlock = source.slice(source.indexOf("new PrismaAuditRepository"));
    expect(auditBlock).not.toContain("internalNote");
  });
});
