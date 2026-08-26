import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePreferencesView } from "@/frontend/features/profile/components/profile-preferences-view";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

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

function chooseUtc() {
  const timezone = screen.getByLabelText("Timezone");
  fireEvent.focus(timezone);
  fireEvent.change(timezone, { target: { value: "UTC" } });
  fireEvent.click(screen.getByRole("button", { name: /GMT\+00:00.*UTC/i }));
}

function startEditing() {
  fireEvent.click(screen.getByRole("button", { name: "Edit preferences" }));
}

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
    expect(screen.getByText("Interface language")).toBeVisible();
    expect(screen.getByText("Asia/Ho_Chi_Minh")).toBeVisible();
    startEditing();
    expect(screen.getByLabelText("Interface language")).toHaveValue("vi");
    expect(screen.getByLabelText("Timezone")).toHaveDisplayValue(
      /Asia.*Ho Chi Minh/i,
    );
    expect(screen.getByLabelText("Application updates")).toBeChecked();
    expect(screen.getByLabelText("Job recommendations")).toBeChecked();
    expect(screen.getByLabelText("Account security")).toBeDisabled();
    expect(screen.getByText(/stay enabled/i)).toBeVisible();
  });

  it("provides a compact, searchable IANA timezone combobox", () => {
    render(
      <ProfilePreferencesView
        initialPreferences={defaults}
        csrfProof="csrf-proof"
      />,
    );
    startEditing();
    const timezone = screen.getByRole("combobox", { name: /Timezone/i });
    expect(timezone.tagName).toBe("INPUT");
    fireEvent.focus(timezone);
    const options = screen.getByRole("listbox", { name: /Timezone options/i });
    expect(within(options).getAllByRole("option")).toHaveLength(8);
    fireEvent.change(timezone, { target: { value: "Ho Chi Minh" } });
    expect(
      screen.getByRole("button", { name: /Asia.*Ho Chi Minh/i }),
    ).toBeVisible();
  });

  it("submits the selected timezone once and reconciles authoritative state", async () => {
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
    startEditing();
    chooseUtc();
    fireEvent.change(screen.getByLabelText("Interface language"), {
      target: { value: "en" },
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
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-proof" }),
      }),
    );
    expect(screen.getByText("English")).toBeVisible();
    expect(screen.getByText("UTC")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit preferences" }),
    ).toBeVisible();
  });

  it("retains a failed timezone selection and focuses persistent feedback", async () => {
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
    startEditing();
    chooseUtc();
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
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
    expect(screen.getByText("Legacy/Removed_Zone")).toBeVisible();
    startEditing();
    expect(screen.getByLabelText("Timezone")).toHaveDisplayValue(
      /Legacy.*Removed Zone/i,
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
