import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const { toast } = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

describe("login form", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });
  it("shows inline validation with password autocomplete", async () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeVisible();
  });
  it("shows one current server error in the fail toast and prevents duplicate submission", async () => {
    let release!: () => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              Response.json(
                { message: "The password is incorrect." },
                { status: 401 },
              ),
            );
        }),
    );
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Email or password is incorrect. (4 attempts remaining)",
      ),
    );
    expect(toast.error).toHaveBeenCalledWith("The password is incorrect.", {
      id: "auth-status",
    });
    fetchMock.mockRestore();
  });

  it("falls back to a generic message when the server returns an empty body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 }),
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Something went wrong. Please try again. (4 attempts remaining)",
      ),
    );

    fetchMock.mockRestore();
  });

  it("locks the form after five failed attempts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        Response.json(
          { message: "Email or password is incorrect." },
          { status: 401 },
        ),
      ),
    );

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(attempt + 1));
    }

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /Your account has been temporarily locked after too many failed sign-in attempts\. Please try again in \d+ minute(s)?\./,
      ),
    );
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();

    fetchMock.mockRestore();
  });
});
