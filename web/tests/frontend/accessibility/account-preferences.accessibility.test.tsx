import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePreferencesView } from "@/frontend/features/profile/components/profile-preferences-view";

const defaults = {
  language: "vi" as const,
  timezone: "Asia/Ho_Chi_Minh",
  timezoneSupported: true,
  emailNotifications: {
    application_updates: true,
    job_recommendations: true,
    account_security: true as const,
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("account-preferences accessibility", () => {
  it("renders defaults and all labelled controls with mandatory security explained", () => {
    render(
      <ProfilePreferencesView
        initialPreferences={defaults}
        csrfProof="csrf-proof"
      />,
    );
    expect(screen.getByLabelText("Language")).toHaveValue("vi");
    expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Ho_Chi_Minh");
    expect(screen.getByLabelText("Application updates")).toBeChecked();
    expect(screen.getByLabelText("Job recommendations")).toBeChecked();
    const security = screen.getByLabelText("Account security");
    expect(security).toBeChecked();
    expect(security).toBeDisabled();
    expect(screen.getByText(/cannot be disabled/i)).toBeVisible();
  });

  it("submits a complete set once, reconciles authoritative state, and announces success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        preferences: {
          ...defaults,
          language: "en",
          timezone: "UTC",
          emailNotifications: {
            ...defaults.emailNotifications,
            application_updates: false,
          },
        },
        message: "Preferences saved.",
      }),
    );
    render(
      <ProfilePreferencesView
        initialPreferences={defaults}
        csrfProof="csrf-proof"
      />,
    );
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "en" },
    });
    fireEvent.change(screen.getByLabelText("Timezone"), {
      target: { value: "UTC" },
    });
    fireEvent.click(screen.getByLabelText("Application updates"));
    const submit = screen.getByRole("button", { name: "Save preferences" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/preferences",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-proof",
        }),
      }),
    );
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByLabelText("Timezone")).toHaveValue("UTC");
  });

  it("retains a failed complete set and focuses persistent feedback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        {
          code: "ACCOUNT_TIMEZONE_UNSUPPORTED",
          message: "Choose a supported timezone.",
          fieldErrors: { timezone: ["Choose a supported timezone."] },
        },
        { status: 400 },
      ),
    );
    render(
      <ProfilePreferencesView
        initialPreferences={defaults}
        csrfProof="csrf-proof"
      />,
    );
    fireEvent.change(screen.getByLabelText("Timezone"), {
      target: { value: "Mars/Olympus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Choose a supported timezone.");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText("Timezone")).toHaveValue("Mars/Olympus");
  });

  it("preserves and explains an unsupported stored timezone", () => {
    render(
      <ProfilePreferencesView
        initialPreferences={{
          ...defaults,
          timezone: "Legacy/Removed_Zone",
          timezoneSupported: false,
        }}
        csrfProof="csrf-proof"
      />,
    );
    expect(screen.getByLabelText("Timezone")).toHaveValue(
      "Legacy/Removed_Zone",
    );
    expect(screen.getByText(/no longer supported/i)).toBeVisible();
  });

  it("ships keyboard focus, non-color cues, reduced motion, and 320px safety", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/frontend/features/profile/styles/account-preferences.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
    expect(css).toMatch(/max-width:\s*100%/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/\[data-feedback-kind=["']error["']\]/);
  });
});
