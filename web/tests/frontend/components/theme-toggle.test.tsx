import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/frontend/components/ui/theme-toggle";
import { ThemeProvider } from "@/frontend/providers/theme-provider";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("switches to dark mode, persists it, and exposes the next action", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      expect(document.documentElement).toHaveClass("dark");
      expect(toggle).toHaveAccessibleName("Switch to light mode");
    });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("smarthire_theme")).toBe("dark");
  });

  it("restores a persisted light theme after a dark theme", async () => {
    window.localStorage.setItem("smarthire_theme", "dark");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "dark"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
      expect(document.documentElement).not.toHaveClass("dark");
    });
    expect(window.localStorage.getItem("smarthire_theme")).toBe("light");
  });
});
