import type { Page } from "@playwright/test";

/** Test-only HTTP fault fixtures. They never alter production server behavior or Better Auth. */
export async function failRegistrationRequest(page: Page) {
  await page.route("**/api/identity/register", (route) =>
    route.fulfill({
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({ message: "The request could not be completed." }),
    }),
  );
}

export async function failResendRequest(page: Page) {
  await page.route("**/api/identity/verification/resend", (route) =>
    route.fulfill({
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({ message: "If an eligible account exists, a verification email will be sent." }),
    }),
  );
}

export async function failAccountRecoveryRequest(page: Page) {
  await page.route("**/api/identity/account-recovery/request", (route) =>
    route.fulfill({
      status: 503,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({
        message:
          "If the account is eligible, account-recovery instructions will be sent.",
      }),
    }),
  );
}
