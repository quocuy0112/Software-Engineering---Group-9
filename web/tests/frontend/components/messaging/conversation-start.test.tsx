import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartConversation } from "@/frontend/features/messaging/components/start-conversation";

afterEach(() => vi.restoreAllMocks());

describe("StartConversation", () => {
  it("searches only server-authorized contacts and opens an eligible context", async () => {
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
    expect(
      screen.getByRole("searchbox", { name: "Tìm người có thể nhắn" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Nhắn tin cho Recruiter B" }),
    );
    await waitFor(() =>
      expect(onOpened).toHaveBeenCalledWith("conversation-1"),
    );
  });

  it("keeps the eligible-only search available when no initial contact is available", () => {
    render(
      <StartConversation
        csrfProof="csrf"
        initialItems={[]}
        onOpened={() => undefined}
      />,
    );

    expect(
      screen.getByRole("searchbox", { name: /search eligible people/i }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      /no eligible contacts yet/i,
    );
  });

  it("replaces the list with the server-filtered eligible search result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              participant: {
                id: "user-match",
                name: "Matching Recruiter",
                image: null,
              },
              contexts: [
                {
                  type: "PROFESSIONAL_CONNECTION",
                  reference: "connection-1",
                  label: "Professional connection",
                  companyName: null,
                  jobTitle: null,
                },
              ],
            },
          ],
          nextCursor: null,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );

    render(
      <StartConversation
        csrfProof="csrf"
        initialItems={[]}
        onOpened={() => undefined}
      />,
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: /search eligible people/i }),
      { target: { value: "Matching" } },
    );

    await waitFor(() =>
      expect(screen.getByText("Matching Recruiter")).toBeVisible(),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/messaging/eligible-participants?q=Matching",
      ),
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
