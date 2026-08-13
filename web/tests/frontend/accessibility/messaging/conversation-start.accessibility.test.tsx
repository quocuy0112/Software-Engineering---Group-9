import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StartConversation } from "@/frontend/features/messaging/components/start-conversation";

describe("conversation start accessibility", () => {
  it("labels search, context, status, and the primary action", () => {
    render(
      <StartConversation
        csrfProof="csrf"
        initialItems={[]}
        onOpened={() => undefined}
      />,
    );
    expect(
      screen.getByRole("searchbox", { name: /search eligible people/i }),
    ).toHaveAttribute("placeholder", "Enter name, email, or account ID");
    expect(screen.getByRole("status")).toHaveTextContent(
      /no eligible contacts yet/i,
    );
  });
});
