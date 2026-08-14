import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "@/frontend/features/notifications/components/notification-center";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("notification center accessibility", () => {
  it("exposes a named disclosure with unread count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          unreadCount: 0,
          observedAt: "2026-08-14T00:00:00.000Z",
        }),
      ),
    );
    render(<NotificationCenter csrfProof="proof" locale="en" />);
    const bell = await screen.findByRole("button", {
      name: "Notifications: 0 unread",
    });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    expect(bell).toHaveAttribute("aria-controls");
  });
});
