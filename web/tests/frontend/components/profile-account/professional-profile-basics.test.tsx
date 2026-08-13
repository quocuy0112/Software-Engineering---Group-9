import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileOverview } from "@/frontend/features/profile/components/profile-overview";

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast }));

const emptyProfile = {
  revision: 0,
  empty: true,
  basics: { headline: null, summary: null, phone: null, location: null },
  skills: [],
  experience: [],
  education: [],
  socialLinks: [],
};

const account = {
  id: "8fc8b912-baad-4be8-8c49-f8f9323f6255",
  name: "Candidate Example",
  email: "candidate@example.com",
  memberSince: "July 31, 2026",
  twoFactorEnabled: true,
};

afterEach(() => {
  vi.restoreAllMocks();
  toast.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
  toast.warning.mockClear();
});

describe("professional profile basics", () => {
  it("copies the account ID from Account Details", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );

    expect(screen.getByText(account.id)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Copy account ID" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(account.id));
    expect(
      screen.getByRole("button", { name: "Account ID copied" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Account ID copied");
  });

  it("renders loading, load-error, and valid empty states", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(
      <ProfileOverview account={account} csrfProof="csrf-proof" />,
    );
    expect(
      screen.getByRole("status", { name: /loading professional profile/i }),
    ).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    resolve(
      Response.json(
        { code: "UNAVAILABLE", message: "Unable to load." },
        { status: 503 },
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load your professional profile.",
    );
    unmount();

    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );
    expect(screen.getByText(/not filled yet/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /start editing/i }),
    ).toBeVisible();
  });

  it("saves basics explicitly and announces persistent success", async () => {
    const saved = {
      ...emptyProfile,
      revision: 1,
      empty: false,
      basics: {
        headline: "Platform Engineer",
        summary: "Builds reliable systems.",
        phone: "+84 912 345 678",
        location: "Hồ Chí Minh",
      },
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          profile: saved,
          conflictApplied: false,
          warnings: [],
          message: "Professional basics saved.",
        }),
      )
      .mockResolvedValueOnce(Response.json(saved));
    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Platform Engineer" },
    });
    fireEvent.change(screen.getByLabelText("Summary"), {
      target: { value: "Builds reliable systems." },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "+84 912 345 678" },
    });
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Hồ Chí Minh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save basics" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/account/profile",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-Token": "csrf-proof",
        }),
      }),
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      section: "basics",
      baseRevision: 0,
      basics: { headline: "Platform Engineer" },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Professional basics saved.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("retains failed values, focuses the invalid field, and blocks duplicates", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );
    const phone = screen.getByLabelText("Phone");
    fireEvent.change(phone, { target: { value: "not-a-phone" } });
    const save = screen.getByRole("button", { name: "Save basics" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();
    resolve(
      Response.json(
        {
          code: "VALIDATION_ERROR",
          message: "Review the highlighted fields.",
          fieldErrors: { "basics.phone": ["Enter a valid phone number."] },
        },
        { status: 400 },
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review the highlighted fields.",
    );
    expect(phone).toHaveValue("not-a-phone");
    expect(phone).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(phone).toHaveFocus());
    expect(toast.error).not.toHaveBeenCalled();
  });
});
