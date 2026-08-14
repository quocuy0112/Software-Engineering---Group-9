import { describe, expect, it, vi } from "vitest";
import { handleSupportMessageKeyDown } from "@/frontend/features/support/components/support-message-keyboard";

function keyEvent(shiftKey = false, isComposing = false) {
  return {
    key: "Enter",
    shiftKey,
    nativeEvent: { isComposing },
    preventDefault: vi.fn(),
  };
}

describe("support message keyboard behavior", () => {
  it("sends and prevents a newline on Enter", () => {
    const event = keyEvent();
    const send = vi.fn();

    handleSupportMessageKeyDown(event, send);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
  });

  it("keeps Shift+Enter as a newline", () => {
    const event = keyEvent(true);
    const send = vi.fn();

    handleSupportMessageKeyDown(event, send);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("does not send while an input method is composing", () => {
    const event = keyEvent(false, true);
    const send = vi.fn();

    handleSupportMessageKeyDown(event, send);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
