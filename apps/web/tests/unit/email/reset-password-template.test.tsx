import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ResetPasswordTemplate,
  resetPasswordEmailText,
} from "@/server/email/templates/reset-password";
import {
  PasswordChangedTemplate,
  passwordChangedEmailText,
} from "@/server/email/templates/password-changed";

describe("reset password email", () => {
  it("renders a configured-origin reset link, expiry, and text alternative without logging", () => {
    const resetUrl = "http://localhost:3000/reset-password?token=opaque";
    const html = renderToStaticMarkup(<ResetPasswordTemplate resetUrl={resetUrl} />);
    expect(html).toContain(resetUrl);
    expect(html).toContain("30 minutes");
    expect(resetPasswordEmailText(resetUrl)).toContain(resetUrl);
    expect(resetPasswordEmailText(resetUrl)).toContain("only once");
  });

  it("renders a secret-free password-change notification", () => {
    const html = renderToStaticMarkup(<PasswordChangedTemplate />);
    expect(html).toContain("password was changed");
    expect(html).toContain("sessions were signed out");
    expect(passwordChangedEmailText()).not.toMatch(/token|code|password=/i);
  });
});
