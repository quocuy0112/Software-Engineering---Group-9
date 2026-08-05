import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import { ProfilePreferencesView } from "@/frontend/features/profile/components/profile-preferences-view";
import { WorkspaceLocaleProvider } from "@/frontend/features/dashboard/client/workspace-locale";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

const defaults: AccountPreferences = {
  language: "en",
  timezone: "Asia/Ho_Chi_Minh",
  timezoneSupported: true,
  emailNotifications: {
    application_updates: true,
    job_recommendations: true,
    account_security: true as const,
  },
};

const vietnameseDefaults = { ...defaults, language: "vi" as const };

function renderPreferences(
  initialPreferences: AccountPreferences = defaults,
  locale: "vi" | "en" = initialPreferences.language,
) {
  return render(
    <WorkspaceLocaleProvider locale={locale}>
      <ProfilePreferencesView
        initialPreferences={initialPreferences}
        csrfProof="csrf-proof"
      />
    </WorkspaceLocaleProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("account-preferences accessibility", () => {
  it("renders the saved language and localizes all controls", () => {
    renderPreferences(vietnameseDefaults, "vi");
    expect(screen.getByLabelText("Ngôn ngữ giao diện")).toHaveValue("vi");
    expect(screen.getByLabelText("Ngôn ngữ giao diện")).not.toBeDisabled();
    expect(screen.getByLabelText("Múi giờ")).toHaveValue("Asia/Ho_Chi_Minh");
    expect(screen.getByLabelText("Cập nhật ứng tuyển")).toBeChecked();
    expect(screen.getByLabelText("Gợi ý việc làm")).toBeChecked();
    const security = screen.getByLabelText("Bảo mật tài khoản");
    expect(security).toBeChecked();
    expect(security).toBeDisabled();
    expect(screen.getByText(/luôn bật/i)).toBeVisible();
  });

  it("provides a searchable IANA timezone list with current GMT offsets", async () => {
    renderPreferences();

    const timezone = screen.getByRole("combobox", { name: /Timezone/i });
    expect(timezone).toHaveAttribute("list", "preference-timezones");

    await waitFor(() => {
      expect(
        document.querySelectorAll("#preference-timezones option").length,
      ).toBeGreaterThan(400);
    });

    const vietnam = document.querySelector(
      '#preference-timezones option[value="Asia/Ho_Chi_Minh"]',
    );
    expect(vietnam).toHaveAttribute(
      "label",
      expect.stringMatching(/^GMT\+07:00 · Asia — Ho Chi Minh$/),
    );
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
    renderPreferences();
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
    expect(screen.getByLabelText("Interface language")).toHaveValue("en");
    expect(screen.getByLabelText("Interface language")).not.toBeDisabled();
    expect(screen.getByLabelText("Timezone")).toHaveValue("UTC");
  });

  it("sends Vietnamese when it is selected and localizes the saved feedback", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        preferences: {
          ...vietnameseDefaults,
          timezone: "UTC",
        },
        message: "Preferences saved.",
      }),
    );
    renderPreferences();
    fireEvent.change(screen.getByLabelText("Interface language"), {
      target: { value: "vi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Đã lưu tùy chọn.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/preferences",
      expect.objectContaining({
        body: expect.stringContaining('"language":"vi"'),
      }),
    );
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
    renderPreferences();
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
    renderPreferences({
      ...defaults,
      timezone: "Legacy/Removed_Zone",
      timezoneSupported: false,
    });
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
