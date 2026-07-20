import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/components/auth/register-form";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

describe("registration and verification UI", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("is keyboard-labelled, validates inline, prevents duplicate submission, and shows generic success", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Check email" }), { status: 202, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", request);
    render(<RegisterForm />);
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Example" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ADA@Example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse 2026" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "correct horse 2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.click(screen.getByRole("button", { name: /Creating account|Create account/ }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
  });
  it("keeps resend feedback inline and enumeration resistant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "If an eligible account exists, a verification email will be sent." }), { status: 202, headers: { "Content-Type": "application/json" } })));
    render(<ResendVerificationForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "nobody@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an eligible account exists");
  });
});
