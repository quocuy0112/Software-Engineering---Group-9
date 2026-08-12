import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  markReadInputSchema,
  messageHistoryQuerySchema,
  messageHistorySchema,
  readBoundarySchema,
} from "@/shared/contracts/messaging/messages";
import { messagingJson } from "@/backend/messaging/http/messaging-route";

describe("messaging history and read REST contract", () => {
  it("bounds history pages and strictly validates read input", () => {
    expect(messageHistoryQuerySchema.parse({ limit: 20 }).limit).toBe(20);
    expect(() => messageHistoryQuerySchema.parse({ limit: 21 })).toThrow();
    expect(markReadInputSchema.parse({ lastReadSequence: 0 })).toEqual({
      lastReadSequence: 0,
    });
    expect(() => markReadInputSchema.parse({ lastReadSequence: -1 })).toThrow();
  });

  it("accepts chronological message pages and authoritative boundaries", () => {
    const boundary = readBoundarySchema.parse({
      conversationId: "conversation-1",
      readerId: "reader",
      lastReadSequence: 2,
      readAt: new Date(0).toISOString(),
    });
    expect(boundary.lastReadSequence).toBe(2);
    expect(() => messageHistorySchema.parse({ items: Array(21).fill({}) })).toThrow();
  });

  it("keeps both Route Handlers and every response no-store", () => {
    expect(
      readFileSync(
        "src/app/api/messaging/conversations/[conversationId]/messages/route.ts",
        "utf8",
      ),
    ).toContain("export async function GET");
    expect(
      readFileSync(
        "src/app/api/messaging/conversations/[conversationId]/read/route.ts",
        "utf8",
      ),
    ).toContain("export async function POST");
    expect(messagingJson({ ok: true }).headers.get("cache-control")).toContain("no-store");
  });
});
