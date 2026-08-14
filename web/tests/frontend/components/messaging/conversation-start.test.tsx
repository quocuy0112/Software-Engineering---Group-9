import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartConversation } from "@/frontend/features/messaging/components/start-conversation";

afterEach(() => vi.restoreAllMocks());

describe("StartConversation", () => {
  it("opens an eligible context without exposing a free-form account search", async () => {
    const onOpened = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "conversation-1",
          otherParticipant: { id: "user-b", name: "Recruiter B", image: null },
          context: {
            type: "APPLICATION",
            reference: "application-1",
            label: "Software Engineer",
            companyName: "Company",
            jobTitle: "Software Engineer",
          },
          lastMessage: null,
          unreadCount: 0,
          blocked: false,
          presence: "OFFLINE",
          createdAt: new Date(0).toISOString(),
          currentLastSequence: 0,
          currentUserLastReadSequence: 0,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <StartConversation
        locale="vi"
        csrfProof="csrf-proof"
        initialItems={[
          {
            participant: { id: "user-b", name: "Recruiter B", image: null },
            contexts: [
              {
                type: "APPLICATION",
                reference: "application-1",
                label: "Software Engineer",
                companyName: "Company",
                jobTitle: "Software Engineer",
              },
            ],
          },
        ]}
        onOpened={onOpened}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Người có thể nhắn" }),
    ).toBeVisible();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Nhắn tin cho Recruiter B" }),
    );
    await waitFor(() =>
      expect(onOpened).toHaveBeenCalledWith("conversation-1"),
    );
  });

  it("does not render a redundant panel when no eligible contact is available", () => {
    const { container } = render(
      <StartConversation
        csrfProof="csrf"
        initialItems={[]}
        onOpened={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
