import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationHeader } from "@/frontend/features/messaging/components/conversation-header";

describe("ConversationHeader", () => {
  it("communicates approximate presence with text instead of color alone", () => {
    render(
      <ConversationHeader
        name="Recruiter B"
        contextLabel="Software Engineer"
        presence="ONLINE"
      />,
    );
    expect(screen.getByLabelText("Recruiter B is online")).toHaveTextContent("Online");
  });
});
