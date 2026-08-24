import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeLegalInformationPage } from "@/frontend/features/home/components/home-legal-information-page";

describe("Home legal information pages", () => {
  afterEach(() => window.localStorage.clear());

  it("returns to Home and makes the other legal documents discoverable", () => {
    render(<HomeLegalInformationPage kind="privacy" />);

    expect(
      screen.getByRole("link", { name: "Quay lại trang chủ" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Điều khoản nền tảng" }),
    ).toHaveAttribute("href", "/legal/terms");
    expect(
      screen.getByRole("link", { name: "Cookie & lưu trữ" }),
    ).toHaveAttribute("href", "/legal/cookies");
    expect(
      screen.getByRole("link", { name: "Mở Trợ giúp & hỗ trợ" }),
    ).toHaveAttribute("href", "/help");
  });

  it("uses the same persisted locale preference as Home", async () => {
    window.localStorage.setItem("smarthire.home.locale", "en");
    render(<HomeLegalInformationPage kind="cookies" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Cookies and local storage" }),
      ).toBeVisible(),
    );
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
