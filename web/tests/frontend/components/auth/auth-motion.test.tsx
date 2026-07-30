import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthMotion } from "@/frontend/features/authentication/components/auth-motion";

const navigation = vi.hoisted(() => ({ pathname: "/login" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

describe("authentication route motion", () => {
  it("keys the animated content to the current authentication route", () => {
    const { rerender } = render(
      <AuthMotion>
        <h1>Sign in</h1>
      </AuthMotion>,
    );
    expect(screen.getByText("Sign in").parentElement).toHaveAttribute(
      "data-route",
      "/login",
    );
    const loginWrapper = screen.getByText("Sign in").parentElement;

    navigation.pathname = "/register";
    rerender(
      <AuthMotion>
        <h1>Create account</h1>
      </AuthMotion>,
    );
    const wrapper = screen.getByText("Create account").parentElement;
    expect(wrapper).toHaveAttribute("data-route", "/register");
    expect(wrapper).not.toBe(loginWrapper);
  });

  it("uses a short transform-only transition with reduced-motion safeguards", async () => {
    const css = await readFile(
      resolve(process.cwd(), "src/frontend/styles/auth.css"),
      "utf8",
    );
    expect(css).toContain("@keyframes auth-content-enter");
    expect(css).toMatch(/animation:\s*auth-content-enter 140ms/);
    expect(css).toMatch(/translate3d\(0,\s*0\.25rem,\s*0\)/);
    const keyframes = css.slice(
      css.indexOf("@keyframes auth-content-enter"),
      css.indexOf("@media (max-width: 320px)"),
    );
    expect(keyframes).not.toContain("filter:");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.auth-motion[\s\S]*?animation:\s*none/,
    );
  });
});
