import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeHeaderNotification } from "@/frontend/features/home/components/home-header-notification";
import { homeCopy } from "@/frontend/features/home/home-copy";
import { candidateViewer } from "../../../helpers/home/home-fixtures";

const notificationCenter = vi.hoisted(() =>
  vi.fn(() => <div data-testid="notification-center" />),
);

vi.mock(
  "@/frontend/features/notifications/components/notification-center",
  () => ({ NotificationCenter: notificationCenter }),
);

const labels = {
  login: homeCopy.en.account.login,
  signup: homeCopy.en.account.signup,
  notificationLabel: homeCopy.en.account.notificationLabel,
  notificationPromptTitle: homeCopy.en.account.notificationPromptTitle,
  notificationPromptDescription: homeCopy.en.account.notificationPromptDescription,
};

describe("Home header notification", () => {
  it("explains how guests can receive notifications and supplies existing auth routes", () => {
    render(
      <HomeHeaderNotification viewer={{ kind: "guest" }} locale="en" labels={labels} />,
    );

    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);

    expect(screen.getByText("Stay informed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Log in" }),
    ).toHaveAttribute("href", "/login?returnTo=%2F");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/register",
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Stay informed")).not.toBeInTheDocument();
  });

  it("uses the existing live notification center for signed-in users", () => {
    render(
      <HomeHeaderNotification
        viewer={candidateViewer}
        locale="en"
        labels={labels}
      />,
    );

    expect(screen.getByTestId("notification-center")).toBeInTheDocument();
    expect(notificationCenter).toHaveBeenCalledWith(
      expect.objectContaining({ csrfProof: "csrf-proof", locale: "en" }),
      undefined,
    );
  });
});
