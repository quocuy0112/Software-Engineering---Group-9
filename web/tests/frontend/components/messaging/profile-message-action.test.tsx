import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileMessageAction } from "@/frontend/features/profile/components/profile-message-action";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockReset();
  vi.restoreAllMocks();
});

describe("ProfileMessageAction", () => {
  it("opens an existing conversation and redirects without creating a duplicate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "existing-conversation" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(
      <ProfileMessageAction
        csrfProof="csrf"
        participantId="target"
        participantName="Alex"
        contexts={[
          {
            type: "PROFESSIONAL_CONNECTION",
            reference: "connection-1",
            label: "Professional connection",
            companyName: null,
            jobTitle: null,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /message alex/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/messages?conversation=existing-conversation"),
    );
  });
});
