import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNotificationContextRead } from "@/frontend/features/notifications/client/use-notification-context-read";

function Subject({ enabled }: { enabled: boolean }) {
  useNotificationContextRead({
    enabled,
    contextType: "CONVERSATION",
    contextId: "conversation-1",
    csrfProof: "proof",
  });
  return null;
}

describe("messaging notification context read", () => {
  it("runs only after protected content is enabled", async () => {
    const fetchMock = vi.fn(async () => Response.json({ changedCount: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Subject enabled={false} />);
    expect(fetchMock).not.toHaveBeenCalled();
    view.rerender(<Subject enabled />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/contexts/read",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-csrf-token": "proof" }),
      }),
    );
  });
});
