import { describe, expect, it } from "vitest";
import { ConnectionError } from "@/backend/connections/connection-errors";
import { connectionRouteError } from "@/backend/connections/http/connection-route";

describe("connection error boundary", () => {
  it("returns the same neutral body for blocked and unavailable resources", async () => {
    const unavailable = await connectionRouteError(
      new ConnectionError("RESOURCE_UNAVAILABLE", 404),
    ).json();
    const blocked = await connectionRouteError(
      new ConnectionError("BLOCKED", 404),
    ).json();
    expect(unavailable.error.message).toBe(blocked.error.message);
  });

  it("exposes only safe retry and current-version metadata", async () => {
    const body = await connectionRouteError(
      new ConnectionError("VERSION_CONFLICT", 409, undefined, 4),
    ).json();
    expect(body.error).toMatchObject({
      code: "VERSION_CONFLICT",
      currentVersion: 4,
    });
  });
});
