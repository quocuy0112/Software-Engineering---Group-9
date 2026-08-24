import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { TwoFactorChallenge } from "@/frontend/features/authentication/components/two-factor-challenge";
const replace = vi.fn(),
  refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});
describe("two-factor challenge", () => {
  it("keeps both verification methods in one switcher and marks the selection", () => {
    render(<TwoFactorChallenge />);
    const switcher = screen.getByRole("group", {
      name: "Verification method",
    });
    const authenticator = within(switcher).getByRole("button", {
      name: "Authenticator code",
    });
    const backupCode = within(switcher).getByRole("button", {
      name: "Backup code",
    });

    expect(authenticator).toHaveAttribute("aria-pressed", "true");
    expect(backupCode).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(backupCode);

    expect(authenticator).toHaveAttribute("aria-pressed", "false");
    expect(backupCode).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a complete authenticator code across six cells and submits it", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "ok" }), { status: 200 }),
      );
    render(<TwoFactorChallenge />);
    expect(
      screen.getByRole("group", { name: "Verification method" }),
    ).toHaveClass("factor-mode-switcher");
    const input = screen.getByLabelText(
      "Authentication code",
    ) as HTMLInputElement;
    const cells = document.querySelectorAll(".totp-code-cell");
    expect(cells).toHaveLength(6);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "12 34-56" } });
    expect([...cells].map((cell) => cell.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][1]?.body as string).toContain("123456");
    expect([...cells].map((cell) => cell.textContent)).toEqual([
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("keeps a normal numeric input for authenticator and virtual keyboards", () => {
    render(<TwoFactorChallenge />);
    const input = screen.getByLabelText(
      "Authentication code",
    ) as HTMLInputElement;

    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    fireEvent.change(input, { target: { value: "123456" } });
    expect(input.value).toBe("123456");
    fireEvent.change(input, { target: { value: "12345" } });
    expect(input.value).toBe("12345");
  });

  it("shows a specific invalid-code message and locks after repeated failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    render(<TwoFactorChallenge />);
    const input = screen.getByLabelText("Authentication code");
    const form = input.closest("form")!;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.submit(form);
      await waitFor(() =>
        expect(globalThis.fetch).toHaveBeenCalledTimes(attempt + 1),
      );
    }

    await screen.findByText(/Try again in 10 minutes/i);
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });
  it("clears sensitive state on unmount and fits a 320px-safe layout", () => {
    const { unmount, container } = render(<TwoFactorChallenge />);
    fireEvent.change(screen.getByLabelText("Authentication code"), {
      target: { value: "123456" },
    });
    unmount();
    expect(container.textContent).toBe("");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  });
});
