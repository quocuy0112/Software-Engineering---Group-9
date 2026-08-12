import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockParticipantDialog } from "@/frontend/features/messaging/components/block-participant-dialog";

beforeEach(() => vi.restoreAllMocks());

describe("BlockParticipantDialog", () => {
  it("confirms an idempotent block and restores focus", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ targetUserId: "user-b", blocked: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const changed = vi.fn();
    render(
      <BlockParticipantDialog
        csrfProof="csrf"
        targetUserId="user-b"
        targetName="Recruiter B"
        blocked={false}
        onChanged={changed}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Block Recruiter B" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveTextContent(/existing message history is retained/i);
    fireEvent.click(screen.getByRole("button", { name: /confirm block/i }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(true));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
