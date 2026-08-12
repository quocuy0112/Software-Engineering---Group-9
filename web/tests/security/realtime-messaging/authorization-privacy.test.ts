import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import { MessagingSocketRegistry } from "@/backend/messaging/realtime/messaging-socket-registry";

describe("realtime messaging authorization and privacy matrix", () => {
  it("denies unrestricted and self messaging at the formal service boundary", async () => {
    const eligibility = new MessagingEligibilityService(
      { hasEligibleRelationship: async () => false, authorizeContext: async () => null },
      { hasEligibleRelationship: async () => false, authorizeContext: async () => null },
    );
    await expect(eligibility.canMessage("user-a", "outsider")).resolves.toBe(false);
    await expect(eligibility.canMessage("user-a", "user-a")).resolves.toBe(false);
  });

  it("removes session, room, and account indexes together on socket revocation", () => {
    const registry = new MessagingSocketRegistry();
    registry.register({ socketId: "socket-a", userId: "user-a", sessionId: "session-a" });
    registry.joinConversation("socket-a", "conversation-a");
    registry.unregister("socket-a");
    expect(registry.socketIdsForUser("user-a").size).toBe(0);
    expect(registry.socketIdsForSession("session-a").size).toBe(0);
    expect(registry.socketIdsForConversation("conversation-a").size).toBe(0);
  });

  it("keeps credentials, message text, and report detail out of URLs, browser stores, and audit calls", () => {
    const sources = globSync("src/**/*.{ts,tsx}")
      .filter((path) => path.includes("messaging"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/localStorage|sessionStorage|auth:\s*\{\s*token/iu);
    expect(sources).not.toMatch(/searchParams\.set\(["'](?:content|detail|token)/iu);
    const reportService = readFileSync("src/backend/messaging/services/report-messaging.ts", "utf8");
    expect(reportService).not.toMatch(/context:\s*\{[\s\S]*?detail/u);
  });

  it("keeps every messaging REST response on the shared no-store boundary", () => {
    for (const route of globSync("src/app/api/messaging/**/route.ts")) {
      const source = readFileSync(route, "utf8");
      expect(source, route).toMatch(/messagingJson|messagingRouteError/u);
    }
  });
});
