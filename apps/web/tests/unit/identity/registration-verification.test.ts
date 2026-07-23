import { describe, expect, it } from "vitest";
import {
  registrationSchema,
  verificationTokenSchema,
  normalizeEmail,
} from "@/features/identity/schemas/registration";
import {
  VerifyEmailTemplate,
  verificationEmailText,
} from "@/server/email/templates/verify-email";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

describe("registration and verification contracts", () => {
  it("normalizes email and rejects malformed/extra payloads", () => {
    const result = registrationSchema.safeParse({
      name: " Ada ",
      email: "ADA@Example.TEST ",
      password: "a secure passphrase",
      passwordConfirmation: "a secure passphrase",
    });
    expect(result.success && result.data.email).toBe("ada@example.test");
    expect(
      registrationSchema.safeParse({
        name: "",
        email: "bad",
        password: "short",
        passwordConfirmation: "different",
        extra: true,
      }).success,
    ).toBe(false);
    expect(verificationTokenSchema.safeParse({ token: "short" }).success).toBe(
      false,
    );
    expect(normalizeEmail(" USER@EXAMPLE.TEST ")).toBe("user@example.test");
  });
  it("renders one trusted verification link in accessible HTML and text", () => {
    const url = "http://localhost:3001/verify-email?token=protected-value";
    const html = renderToStaticMarkup(
      createElement(VerifyEmailTemplate, { verificationUrl: url }),
    );
    expect(html.match(/href=/g) ?? []).toHaveLength(1);
    expect(html).toContain("Verify email");
    expect(verificationEmailText(url)).toContain(url);
  });
});
