import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Link from "next/link";
import { HomeMobileNavigation } from "@/frontend/features/home/client/home-mobile-navigation";

describe("Home compact navigation", () => {
  it("uses a semantic localized control, traps focus, and restores it on Escape", () => {
    render(
      <HomeMobileNavigation label="Open navigation menu">
        <Link href="/jobs">Explore Jobs</Link>
        <button type="button">Log out</button>
      </HomeMobileNavigation>,
    );
    const trigger = screen.getByRole("button", { name: "Open navigation menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const first = screen.getByRole("link", { name: "Explore Jobs" });
    const last = screen.getByRole("button", { name: "Log out" });
    expect(first).toHaveFocus();
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
