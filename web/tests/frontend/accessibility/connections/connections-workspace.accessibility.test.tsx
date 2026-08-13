import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { ConnectionsWorkspace } from "@/frontend/features/connections/components/connections-workspace";

vi.mock(
  "@/frontend/features/connections/client/use-connection-invalidation",
  () => ({
    useConnectionInvalidation: () => "CONNECTED",
  }),
);

describe("Connections workspace accessibility", () => {
  it("uses text states, named actions, headings, and no serious axe violations", async () => {
    const { container } = render(
      <ConnectionsWorkspace
        csrfProof="csrf"
        initialConnections={[]}
        initialNotifications={[]}
        initialProposals={[
          {
            id: "proposal-1",
            otherParticipant: {
              id: "participant-b",
              displayName: "Participant B",
              image: null,
            },
            reason: "Discuss an appropriate professional opportunity",
            state: "PENDING_BOTH",
            version: 1,
            myDecision: null,
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            createdAt: new Date().toISOString(),
            terminalAt: null,
            detailAvailable: true,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Professional Connections" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Realtime connected");
    expect(screen.getByRole("button", { name: "Accept" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Decline" })).toBeVisible();
    const result = await axe.run(container);
    expect(
      result.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
  });
});
