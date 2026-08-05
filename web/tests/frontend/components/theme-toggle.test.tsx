import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";
import { ThemeProvider } from "@/frontend/providers/theme-provider";

describe("theme toggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  it("switches the document theme without a server request", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", {
      name: "Switch to dark mode",
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("smarthire-theme")).toBe("dark");
  });
});
