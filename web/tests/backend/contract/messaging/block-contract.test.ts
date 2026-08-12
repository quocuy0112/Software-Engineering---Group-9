import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blockProjectionSchema } from "@/shared/contracts/messaging/safety";
import { messagingJson } from "@/backend/messaging/http/messaging-route";

describe("messaging block contract", () => {
  it("returns only shared safe block state", () => {
    expect(blockProjectionSchema.parse({ targetUserId: "user-b", blocked: true })).toEqual({
      targetUserId: "user-b",
      blocked: true,
    });
    expect(() =>
      blockProjectionSchema.parse({ targetUserId: "user-b", blocked: true, blocker: "user-a" }),
    ).toThrow();
  });

  it("implements both methods with no-store responses", () => {
    const route = readFileSync("src/app/api/messaging/blocks/[targetUserId]/route.ts", "utf8");
    expect(route).toContain("export async function POST");
    expect(route).toContain("export async function DELETE");
    expect(messagingJson({ blocked: true }).headers.get("cache-control")).toContain("no-store");
  });
});
