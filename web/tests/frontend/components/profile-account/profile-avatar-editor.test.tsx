import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileAvatarEditor } from "@/frontend/features/profile/components/profile-avatar-editor";

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));
vi.mock("sonner", () => ({ toast }));

const avatar =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

afterEach(() => {
  vi.restoreAllMocks();
  toast.error.mockClear();
  toast.success.mockClear();
});

describe("profile avatar editor", () => {
  it("shows the persisted photo with a simple replacement flow", () => {
    render(
      <ProfileAvatarEditor
        accountName="Candidate Example"
        initialAvatar={avatar}
        csrfProof="csrf-proof"
      />,
    );

    expect(
      screen.getByAltText(/Candidate Example's profile photo/i),
    ).toHaveAttribute("src", avatar);
    expect(screen.getByLabelText("Choose another photo")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(screen.queryByText("Crop shape")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Zoom")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save photo" })).toBeDisabled();
  });

  it("rejects unsafe file types before upload", async () => {
    render(
      <ProfileAvatarEditor
        accountName="Candidate Example"
        csrfProof="csrf-proof"
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose photo"), {
      target: {
        files: [new File(["<svg />"], "avatar.svg", { type: "image/svg+xml" })],
      },
    });

    expect(
      await screen.findByText(/Choose a PNG, JPEG, or WebP image up to 5 MB/i),
    ).toBeVisible();
  });

  it("removes a stored photo through the protected account endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ image: null, message: "Profile photo removed." }),
      );
    render(
      <ProfileAvatarEditor
        accountName="Candidate Example"
        initialAvatar={avatar}
        csrfProof="csrf-proof"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog", {
      name: "Remove profile photo?",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove photo" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/account/profile/avatar",
        expect.objectContaining({
          method: "DELETE",
          headers: { "X-CSRF-Token": "csrf-proof" },
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile photo removed.",
    );
    expect(toast.success).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });
});
