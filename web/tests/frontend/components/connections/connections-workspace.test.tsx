import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionsWorkspace } from "@/frontend/features/connections/components/connections-workspace";

vi.mock(
  "@/frontend/features/connections/client/use-connection-invalidation",
  () => ({ useConnectionInvalidation: () => "CONNECTED" }),
);

describe("Connections workspace", () => {
  it("explains bilateral consent and renders independent actions", () => {
    render(
      <ConnectionsWorkspace
        csrfProof="csrf"
        initialConnections={[]}
        initialNotifications={[]}
        initialProposals={[
          {
            id: "proposal-1",
            otherParticipant: {
              id: "user-b",
              displayName: "Alex B",
              image: null,
            },
            reason: "Discuss a relevant engineering opportunity",
            state: "PENDING_BOTH",
            version: 1,
            myDecision: null,
            expiresAt: "2026-08-20T00:00:00.000Z",
            createdAt: "2026-08-19T00:00:00.000Z",
            terminalAt: null,
            detailAvailable: true,
          },
        ]}
      />,
    );
    expect(
      screen.getByText(/messaging opens only after both people accept/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
    expect(screen.getByText("20 Aug 2026")).toBeVisible();
  });

  it("formats notification timestamps deterministically", () => {
    render(
      <ConnectionsWorkspace
        csrfProof="csrf"
        initialConnections={[]}
        initialProposals={[]}
        initialNotifications={[
          {
            id: "notification-1",
            kind: "PROPOSAL_CREATED",
            title: "New proposal",
            message: "A new professional connection was proposed.",
            proposalId: "proposal-1",
            connectionId: null,
            createdAt: "2026-08-20T00:00:00.000Z",
            readAt: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("20 Aug 2026, 07:00")).toBeVisible();
  });

  it("requires disconnect confirmation and labels revoked history read-only", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ConnectionsWorkspace
        csrfProof="csrf"
        initialProposals={[]}
        initialNotifications={[]}
        initialConnections={[
          {
            id: "connection-1",
            otherParticipant: {
              id: "user-b",
              displayName: "Alex B",
              image: null,
            },
            state: "ACCEPTED",
            version: 1,
            acceptedAt: new Date().toISOString(),
            revokedAt: null,
          },
          {
            id: "connection-2",
            otherParticipant: {
              id: "user-c",
              displayName: "Sam C",
              image: null,
            },
            state: "REVOKED",
            version: 2,
            acceptedAt: new Date().toISOString(),
            revokedAt: new Date().toISOString(),
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("read-only"));
    expect(
      screen.getByText(/connection ended — history remains read-only/i),
    ).toBeVisible();
  });
});
