import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createSupportCaseInputSchema,
  sendSupportMessageInputSchema,
} from "@/shared/contracts/support";
import { supportJson } from "@/backend/support/http/support-route";

describe("support Route Handler contracts", () => {
  it("requires bounded input and optimistic concurrency", () => {
    expect(
      createSupportCaseInputSchema.parse({
        category: "MESSAGING",
        subject: "Messaging assistance",
        message: "I cannot reply to an eligible participant.",
        clientOperationId: "04f48a40-c81c-4d14-b556-a2af60f3b2a7",
      }).category,
    ).toBe("MESSAGING");
    expect(() =>
      sendSupportMessageInputSchema.parse({
        content: "Retrying",
        clientOperationId: "04f48a40-c81c-4d14-b556-a2af60f3b2a7",
      }),
    ).toThrow();
  });

  it("applies no-store and safe response headers", async () => {
    const response = supportJson({ data: [] });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noarchive");
    expect(await response.json()).toEqual({ data: [] });
  });

  it("keeps requester and administrator authorization boundaries explicit", () => {
    const requesterRoute = readFileSync(
      "src/app/api/support/cases/route.ts",
      "utf8",
    );
    const adminRoute = readFileSync(
      "src/app/api/admin/support-cases/route.ts",
      "utf8",
    );
    const commandRoute = readFileSync(
      "src/app/api/admin/support-cases/[caseId]/[action]/route.ts",
      "utf8",
    );

    expect(requesterRoute).toContain("SupportRequestBoundary");
    expect(adminRoute).toContain("AdminRequestBoundary");
    expect(commandRoute).toContain("expectedVersion");
    expect(commandRoute).toContain("idempotencyKey");
    expect(commandRoute).not.toContain("messagingConversation");
  });
});
