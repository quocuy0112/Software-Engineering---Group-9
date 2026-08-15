import { render } from "react-email";
import { createElement } from "react";
import {
  PasswordChangedTemplate,
  passwordChangedEmailText,
} from "@/backend/email/templates/password-changed";
import {
  ResetPasswordTemplate,
  resetPasswordEmailText,
} from "@/backend/email/templates/reset-password";
import {
  VerifyEmailTemplate,
  verificationEmailText,
} from "@/backend/email/templates/verify-email";

const PREVIEW_VERIFICATION_URL = "https://preview.invalid/verify-email";
const PREVIEW_RESET_URL = "https://preview.invalid/reset-password#token";

export type LocalEmailPreview = {
  name: "verify-email" | "reset-password" | "password-changed";
  html: string;
  text: string;
};

/** Renders every template in memory with non-secret fixture URLs and no network adapter. */
export async function renderLocalEmailPreviews(): Promise<LocalEmailPreview[]> {
  return [
    {
      name: "verify-email",
      html: await render(
        createElement(VerifyEmailTemplate, {
          verificationUrl: PREVIEW_VERIFICATION_URL,
        }),
      ),
      text: verificationEmailText(PREVIEW_VERIFICATION_URL),
    },
    {
      name: "reset-password",
      html: await render(
        createElement(ResetPasswordTemplate, { resetUrl: PREVIEW_RESET_URL }),
      ),
      text: resetPasswordEmailText(PREVIEW_RESET_URL),
    },
    {
      name: "password-changed",
      html: await render(createElement(PasswordChangedTemplate)),
      text: passwordChangedEmailText(),
    },
  ];
}

if (process.env.NODE_ENV !== "test") {
  void renderLocalEmailPreviews().then((previews) => {
    console.log(`Rendered ${previews.length} local SmartHire email previews.`);
  });
}
