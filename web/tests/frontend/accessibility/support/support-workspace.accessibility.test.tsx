import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupportWorkspace } from "@/frontend/features/support/components/support-workspace";

vi.mock("@/frontend/features/support/client/use-support-invalidation", () => ({
  useSupportInvalidation: () => "CONNECTED",
}));

describe("Support Center accessibility", () => {
  it("labels creation, navigation, status, and reply controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "case-1",
            category: "MESSAGING",
            subject: "Messaging assistance",
            state: "WAITING_FOR_USER",
            version: 2,
            correspondent: "SmartHire Support",
            lastMessageAt: "2026-08-13T01:00:00.000Z",
            createdAt: "2026-08-13T00:00:00.000Z",
            updatedAt: "2026-08-13T01:00:00.000Z",
            contentAvailable: true,
            messages: [],
          },
        }),
      }),
    );

    render(
      <SupportWorkspace
        csrfProof="proof"
        initialCases={[
          {
            id: "case-1",
            category: "MESSAGING",
            subject: "Messaging assistance",
            state: "WAITING_FOR_USER",
            version: 2,
            correspondent: "SmartHire Support",
            lastMessageAt: "2026-08-13T01:00:00.000Z",
            createdAt: "2026-08-13T00:00:00.000Z",
            updatedAt: "2026-08-13T01:00:00.000Z",
            contentAvailable: true,
          },
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Realtime connected");
    const navigation = screen.getByRole("complementary", {
      name: "Support cases",
    });
    expect(within(navigation).getByLabelText("Category")).toBeVisible();
    expect(within(navigation).getByLabelText("Subject")).toBeRequired();
    expect(
      within(navigation).getByLabelText("How can we help?"),
    ).toBeRequired();
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Reply to SmartHire Support" }),
      ).toBeVisible(),
    );
  });
});
