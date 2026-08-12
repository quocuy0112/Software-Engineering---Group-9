import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  conversationDetailSchema,
  eligibleParticipantListSchema,
  openConversationInputSchema,
} from "@/shared/contracts/messaging";
import { messagingJson } from "@/backend/messaging/http/messaging-route";

describe("messaging conversation REST contract", () => {
  it("strictly parses application and accepted-connection inputs", () => {
    expect(
      openConversationInputSchema.parse({
        targetUserId: "user-b",
        context: { type: "APPLICATION", applicationId: "application-1" },
      }).context.type,
    ).toBe("APPLICATION");
    expect(() =>
      openConversationInputSchema.parse({
        targetUserId: "user-b",
        context: { type: "APPLICATION", applicationId: "application-1", extra: true },
      }),
    ).toThrow();
  });

  it("keeps projections safe and bounded", () => {
    expect(
      eligibleParticipantListSchema.parse({
        items: [
          {
            participant: { id: "user-b", name: "User B", image: null },
            contexts: [
              {
                type: "PROFESSIONAL_CONNECTION",
                reference: "connection-1",
                label: "Professional connection",
                companyName: null,
                jobTitle: null,
              },
            ],
          },
        ],
        nextCursor: null,
      }).items,
    ).toHaveLength(1);
    expect(() =>
      conversationDetailSchema.parse({ email: "private@example.test" }),
    ).toThrow();
  });

  it("sets no-store on every messaging JSON response", async () => {
    const response = messagingJson({ ok: true }, { status: 201 });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("keeps endpoints in Next.js Route Handlers", () => {
    expect(
      readFileSync("src/app/api/messaging/conversations/route.ts", "utf8"),
    ).toContain("export async function POST");
    expect(
      readFileSync(
        "src/app/api/messaging/eligible-participants/route.ts",
        "utf8",
      ),
    ).toContain("export async function GET");
  });
});
