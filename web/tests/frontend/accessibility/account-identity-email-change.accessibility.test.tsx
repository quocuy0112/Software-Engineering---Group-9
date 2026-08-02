import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileAccountView } from "@/frontend/features/profile/components/profile-account-view";
import { VerifyEmailChangeForm } from "@/frontend/features/profile/components/verify-email-change-form";

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast }));

const identity = {
  name: "Nguyen Van An",
  email: "candidate@example.test",
  emailVerified: true,
  accountState: "ACTIVE" as const,
  createdAt: "2026-07-31T00:00:00.000Z",
  pendingEmailChange: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("account identity and email-change accessibility", () => {
  it("labels editable identity separately from immutable metadata and announces save", async () => {
    const updated = { ...identity, name: "Nguyen Van Binh" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        identity: updated,
        warnings: [],
        message: "Account identity saved.",
      }),
    );
    render(
      <ProfileAccountView initialIdentity={identity} csrfProof="csrf-proof" />,
    );
    expect(screen.getByText("candidate@example.test")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText(/31.*2026|2026/)).toBeVisible();
    const name = screen.getByLabelText("Full name");
    fireEvent.change(name, { target: { value: "Nguyen Van Binh" } });
    fireEvent.click(screen.getByRole("button", { name: "Save full name" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Account identity saved.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/identity",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-proof",
        }),
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("retains email inputs, reuses an idempotency key, and renders safe pending state", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    render(
      <ProfileAccountView
        initialIdentity={{
          ...identity,
          pendingEmailChange: {
            proposedEmail: "pending@example.test",
            expiresAt: "2026-07-31T00:30:00.000Z",
          },
        }}
        csrfProof="csrf-proof"
      />,
    );
    expect(screen.getByText(/pending@example\.test/)).toBeVisible();
    expect(document.body.textContent).not.toMatch(/proof|digest|token/i);
    fireEvent.change(screen.getByLabelText("Proposed email"), {
      target: { value: "next@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current password 2026!" },
    });
    const submit = screen.getByRole("button", {
      name: "Request verification email",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const key = new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get(
      "Idempotency-Key",
    );
    expect(key).toMatch(/^[A-Za-z0-9_-]{20,128}$/);
    resolve(
      Response.json(
        {
          code: "MUTATION_UNAVAILABLE",
          message: "The request could not be queued. Try again.",
        },
        { status: 503 },
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    expect(screen.getByLabelText("Proposed email")).toHaveValue(
      "next@example.test",
    );
  });

  it.each([
    "EMAIL_CHANGE_PROOF_INVALID",
    "EMAIL_CHANGE_PROOF_EXPIRED",
    "EMAIL_CHANGE_PROOF_SUPERSEDED",
  ])(
    "removes the fragment and offers a focusable fresh-request action for %s",
    async (code) => {
      window.history.replaceState(
        null,
        "",
        `/verify-email-change#proof=${"a".repeat(43)}`,
      );
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        Response.json(
          {
            code,
            message: "This verification link cannot be used.",
          },
          { status: 400 },
        ),
      );
      render(<VerifyEmailChangeForm />);
      await waitFor(() => expect(window.location.hash).toBe(""));
      expect(globalThis.fetch).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "Confirm email change" }),
      );
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("This verification link cannot be used.");
      await waitFor(() => expect(alert).toHaveFocus());
      expect(
        screen.getByRole("link", {
          name: "Request a new verification email",
        }),
      ).toHaveAttribute("href", "/profile/account");
      expect(document.body.textContent).not.toContain("a".repeat(43));
    },
  );

  it("ships keyboard focus, reduced-motion, and 320px-safe account styles", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/frontend/features/profile/styles/account-identity-email-change.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
    expect(css).toMatch(/max-width:\s*100%/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
