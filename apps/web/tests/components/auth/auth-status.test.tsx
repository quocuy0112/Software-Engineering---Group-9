import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => {
  const toastError = vi.fn();
  const toastSuccess = vi.fn();
  const toast = vi.fn();
  return {
    toast: Object.assign(toast, {
      error: toastError,
      success: toastSuccess,
    }),
  };
});

import { toast } from "sonner";
import { AuthStatus } from "@/components/auth/auth-status";

describe("AuthStatus", () => {
  it("splits multiline statuses into separate error messages", () => {
    render(<AuthStatus status={"First issue\nSecond issue"} tone="error" />);

    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenNthCalledWith(1, "First issue", expect.anything());
    expect(toast.error).toHaveBeenNthCalledWith(2, "Second issue", expect.anything());
  });
});
