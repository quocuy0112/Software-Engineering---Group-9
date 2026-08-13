import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupportWorkspace } from "@/frontend/features/support/components/support-workspace";

vi.mock("@/frontend/features/support/client/use-support-invalidation", () => ({
  useSupportInvalidation: () => "CONNECTED",
}));

const supportCase = {
  id: "case-1",
  category: "MESSAGING" as const,
  subject: "Cannot send a message",
  state: "WAITING_FOR_USER" as const,
  version: 2,
  correspondent: "SmartHire Support" as const,
  lastMessageAt: "2026-08-13T01:00:00.000Z",
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T01:00:00.000Z",
  contentAvailable: true,
};

describe("SupportWorkspace", () => {
  it("shows SmartHire Support identity and requester-safe messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            ...supportCase,
            messages: [
              {
                id: "message-1",
                sequence: 1,
                author: "SMART_HIRE_SUPPORT",
                content: "Please retry after refreshing your session.",
                createdAt: "2026-08-13T01:00:00.000Z",
              },
            ],
          },
        }),
      }),
    );
    render(<SupportWorkspace csrfProof="proof" initialCases={[supportCase]} />);
    await waitFor(() =>
      expect(
        screen.getByText("Please retry after refreshing your session."),
      ).toBeVisible(),
    );
    expect(screen.getAllByText("SmartHire Support").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/cannot read your ordinary conversations/i),
    ).toBeVisible();
    expect(
      screen.queryByText(/administrator account/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Online")).toBeVisible();
    expect(
      screen.getByLabelText("Support conversation messages"),
    ).toBeVisible();
  });

  it("sends a reply with Enter", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (path: string, init?: RequestInit) => {
        const data =
          path === "/api/support/cases" && !init?.method
            ? [supportCase]
            : {
                ...supportCase,
                version: init?.method === "POST" ? 3 : 2,
                messages: [],
              };
        return { ok: true, json: async () => ({ data }) };
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<SupportWorkspace csrfProof="proof" initialCases={[supportCase]} />);
    const reply = await screen.findByRole("textbox", {
      name: "Reply to SmartHire Support",
    });

    fireEvent.change(reply, { target: { value: "Please check this case." } });
    fireEvent.keyDown(reply, { key: "Enter", shiftKey: false });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/support/cases/case-1/messages",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("shows terminal guidance instead of a reply composer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { ...supportCase, state: "CLOSED", messages: [] },
        }),
      }),
    );
    render(
      <SupportWorkspace
        csrfProof="proof"
        initialCases={[{ ...supportCase, state: "CLOSED" }]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/this case is closed/i)).toBeVisible(),
    );
    expect(
      screen.queryByRole("textbox", { name: /reply to smartHire support/i }),
    ).not.toBeInTheDocument();
  });
});
