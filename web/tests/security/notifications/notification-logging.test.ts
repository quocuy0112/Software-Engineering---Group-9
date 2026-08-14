import { afterEach, describe, expect, it, vi } from "vitest";
import { emitNotificationOperation } from "@/backend/notifications/notification-operations";

describe("notification operation logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits only bounded operational dimensions", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    emitNotificationOperation({
      operation: "create",
      outcome: "failure",
      correlationId: "request with spaces",
      durationMs: 4.4,
      affectedCount: 1,
      errorCode: "DATABASE failure<script>",
    });
    const event = JSON.parse(String(info.mock.calls[0]?.[0]));
    expect(event).toEqual({
      scope: "in-app-notification",
      operation: "create",
      outcome: "failure",
      correlationId: "request_with_spaces",
      durationMs: 4,
      affectedCount: 1,
      errorCode: "DATABASE_failure_script_",
    });
    expect(JSON.stringify(event)).not.toContain("recipient");
  });
});
