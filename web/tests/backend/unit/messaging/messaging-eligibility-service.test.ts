import { describe, expect, it } from "vitest";
import { MessagingEligibilityService } from "@/backend/messaging/authorization/messaging-eligibility-service";
import type {
  AuthorizedMessagingContext,
  MessagingEligibilityProvider,
} from "@/backend/messaging/ports/eligibility-provider";

class FakeProvider implements MessagingEligibilityProvider {
  constructor(private readonly allowed: boolean) {}
  async hasEligibleRelationship() {
    return this.allowed;
  }
  async authorizeContext(): Promise<AuthorizedMessagingContext | null> {
    return null;
  }
}

describe("MessagingEligibilityService.canMessage", () => {
  it.each([
    {
      connection: true,
      application: false,
      expected: true,
      name: "accepted connection",
    },
    {
      connection: false,
      application: true,
      expected: true,
      name: "application",
    },
    { connection: true, application: true, expected: true, name: "both" },
    { connection: false, application: false, expected: false, name: "neither" },
  ])(
    "returns $expected for $name",
    async ({ application, connection, expected }) => {
      const service = new MessagingEligibilityService(
        new FakeProvider(application),
        new FakeProvider(connection),
      );
      await expect(service.canMessage("user-a", "user-b")).resolves.toBe(
        expected,
      );
    },
  );

  it("always rejects self messaging", async () => {
    const service = new MessagingEligibilityService(
      new FakeProvider(true),
      new FakeProvider(true),
    );
    await expect(service.canMessage("user-a", "user-a")).resolves.toBe(false);
  });
});
