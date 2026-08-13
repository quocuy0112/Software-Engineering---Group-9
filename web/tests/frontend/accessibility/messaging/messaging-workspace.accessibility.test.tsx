import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { StartConversation } from "@/frontend/features/messaging/components/start-conversation";
import { BlockParticipantDialog } from "@/frontend/features/messaging/components/block-participant-dialog";
import { ReportMessagingDialog } from "@/frontend/features/messaging/components/report-messaging-dialog";
import { ConversationHeader } from "@/frontend/features/messaging/components/conversation-header";

vi.mock("@/frontend/features/messaging/client/messaging-api", () => ({
  openConversation: vi.fn(),
  submitMessagingReport: vi.fn(),
}));

async function expectNoSeriousViolations(container: HTMLElement) {
  const result = await axe.run(container);
  expect(
    result.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

describe("messaging accessibility", () => {
  it("passes discovery and non-color presence checks", async () => {
    const { container } = render(
      <main>
        <StartConversation csrfProof="csrf" initialItems={[]} onOpened={() => undefined} />
        <ConversationHeader name="Recruiter B" contextLabel="Software Engineer" presence="OFFLINE" />
      </main>,
    );
    expect(screen.getByLabelText("Recruiter B is offline")).toHaveTextContent("Offline");
    await expectNoSeriousViolations(container);
  });

  it("passes keyboard-visible block and report dialog checks", async () => {
    const { container } = render(
      <main>
        <BlockParticipantDialog
          csrfProof="csrf"
          targetUserId="user-b"
          targetName="Recruiter B"
          blocked={false}
          onChanged={() => undefined}
        />
        <ReportMessagingDialog
          csrfProof="csrf"
          conversationId="conversation-1"
          targetUserId="user-b"
          messages={[]}
        />
      </main>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Block Recruiter B" }));
    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    await expectNoSeriousViolations(container);
  });
});
