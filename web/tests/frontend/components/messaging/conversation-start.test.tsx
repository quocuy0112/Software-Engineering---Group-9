import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartConversation } from "@/frontend/features/messaging/components/start-conversation";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("StartConversation", () => {
  it("opens an eligible context with keyboard-accessible controls", async () => {
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
      screen.getByRole("dialog", { name: /start a conversation/i }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /message recruiter b/i }),
    );
    await waitFor(() =>
      expect(onOpened).toHaveBeenCalledWith("conversation-1"),
    );
  });

  it("renders a meaningful empty state", () => {
    render(
      <StartConversation
        csrfProof="csrf"
        initialItems={[]}
        onOpened={() => undefined}
      />,
    );
    expect(screen.getByText(/no eligible contacts yet/i)).toBeVisible();
    expect(
      screen.getByText(/establish a professional connection/i),
    ).toBeVisible();
  });

  it("explains eligibility without revealing whether an account exists", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ items: [], nextCursor: null }),
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
      { target: { value: "person@example.test" } },
    );
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(
      screen.getByText(/no eligible messaging relationship/i),
    ).toBeVisible();
    expect(
      screen.getByText(/accepted professional connections/i),
    ).toBeVisible();
    expect(
      screen.queryByText(/account does not exist/i),
    ).not.toBeInTheDocument();
  });

  it("debounces server search and aborts stale requests", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        signals.push(init?.signal as AbortSignal);
        return Response.json({
          items: [
            {
              participant: {
                id: "8fc8b912-baad-4be8-8c49-f8f9323f6255",
                name: "Recruiter Result",
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
        });
      });
    render(
      <StartConversation
        csrfProof="csrf"
        initialItems={[]}
        onOpened={() => undefined}
      />,
    );
    const search = screen.getByRole("searchbox", {
      name: /search eligible people/i,
    });

    fireEvent.change(search, { target: { value: "r" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/at least 2/i);

    fireEvent.change(search, { target: { value: "re" } });
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/messaging/eligible-participants?q=re",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.change(search, {
      target: { value: "recruiter@example.test" },
    });
    expect(signals[0]?.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/messaging/eligible-participants?q=recruiter%40example.test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText("Recruiter Result")).toBeVisible();
  });
});
