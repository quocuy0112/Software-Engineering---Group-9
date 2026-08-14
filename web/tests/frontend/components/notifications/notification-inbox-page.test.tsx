import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNotificationInbox } from "@/frontend/features/notifications/components/notification-inbox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("notification inbox", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: RequestInfo | URL) => {
        const url = String(request);
        if (url.includes("/read")) {
          return Response.json({
            changedCount: 1,
            unreadCount: 0,
            observedAt: "2026-08-14T00:00:02.000Z",
          });
        }
        return Response.json({
          items: [
            {
              id: "notification-1",
              kind: "APPLICATION_STAGE_CHANGED",
              category: "APPLICATION",
              severity: "MEDIUM",
              title: "Application updated",
              summary: "Your application moved to INTERVIEW.",
              href: "/jobs/applied/application-1",
              contextType: "APPLICATION",
              contextId: "application-1",
              occurrenceCount: 1,
              readAt: null,
              createdAt: "2026-08-14T00:00:00.000Z",
              lastOccurredAt: "2026-08-14T00:00:00.000Z",
              expiresAt: "2026-11-12T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          unreadCount: 1,
          observedAt: "2026-08-14T00:00:01.000Z",
        });
      }),
    );
  });

  it("filters, marks read, and opens an allow-listed destination", async () => {
    render(<AdminNotificationInbox getCsrfProof={() => "proof"} />);
    fireEvent.click(await screen.findByRole("button", { name: "Unread" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /application updated/i }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/jobs/applied/application-1"),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/notifications/notification-1/read",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
