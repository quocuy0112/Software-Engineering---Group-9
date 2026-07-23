import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const password = "correct horse 2026";

/** RFC 4648 base32 decode (no padding required); authenticator secrets are base32. */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** Compute a six-digit RFC 6238 TOTP for the given base32 secret and 30s period. */
function totp(secret: string, forTime = Date.now()): string {
  const counter = Math.floor(forTime / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function registerVerifyAndSignIn(page: Page): Promise<string> {
  const email = `totp-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const mail = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mail).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill("TOTP Candidate");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  let link = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mail)).filter(
        (item) => !before.has(item),
      )) {
        const body = await readFile(resolve(mail, name), "utf8");
        if (body.includes(`To: ${email}`)) {
          link =
            body.match(
              /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/,
            )?.[0] ?? "";
        }
      }
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  return email;
}

async function selectBackupCode(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Backup code" });
  await expect(button).toBeEnabled();
  await expect(async () => {
    if ((await button.getAttribute("aria-pressed")) !== "true") {
      await button.click();
    }
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 5_000 });
  await expect(page.getByLabel("Backup code")).toBeVisible();
}

test("enrolls TOTP and completes backup-code login end-to-end", async ({
  page,
}) => {
  test.setTimeout(420000);
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  });
  const email = await registerVerifyAndSignIn(page);

  await page.goto("/profile/security");
  await expect(
    page.getByRole("heading", { name: "Set up two-factor authentication" }),
  ).toBeVisible();

  const enrollmentPanel = page.getByRole("region", {
    name: "Set up two-factor authentication",
  });
  await enrollmentPanel
    .getByLabel("Current password", { exact: true })
    .fill(password);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  const enrollmentStart = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/enrollment") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  const startResponse = await enrollmentStart;
  const startBody = (await startResponse.json().catch(() => ({}))) as {
    message?: string;
  };
  expect(
    startResponse.status(),
    `Enrollment start failed (${startResponse.status()}): ${startBody.message ?? "no safe response body"}`,
  ).toBe(200);
  expect(startBody.message ?? "").not.toMatch(
    /password|secret|token|cookie|otpauth/i,
  );

  // Real QR image rendered server-side plus the manual setup key (the base32 secret).
  const qr = page.getByRole("img", { name: /QR code/i });
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByText("Can't scan?")).toBeVisible();

  const manualKey = (
    await page.locator(".totp-manual code").innerText()
  ).trim();
  expect(manualKey.length).toBeGreaterThan(0);

  await page.getByLabel("Six-digit code").fill(totp(manualKey));
  const enrollmentVerify = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/enrollment/verify") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify and enable" }).click();
  const enrollmentVerifyResponse = await enrollmentVerify;
  const enrollmentVerifyBody = (await enrollmentVerifyResponse.json()) as {
    backupCodes: string[];
  };
  expect(enrollmentVerifyResponse.status()).toBe(200);
  expect(enrollmentVerifyBody.backupCodes).toHaveLength(10);
  const backupCode = enrollmentVerifyBody.backupCodes[0];
  const managementLoginCode = enrollmentVerifyBody.backupCodes[1];
  const oldCode = enrollmentVerifyBody.backupCodes[2];

  await expect(
    page.getByRole("heading", { name: "Save your backup codes" }),
  ).toBeVisible();
  await expect(page.locator(".backup-codes li")).toHaveCount(10);
  await expect(page.locator("[data-warning]")).toContainText("shown only once");

  // A 2FA account receives only a pre-auth challenge after password login.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/two-factor/);
  await expect(page.getByLabel("Authentication code")).toBeFocused();
  await page.getByLabel("Authentication code").fill("000000");
  await page.getByLabel("Authentication code").press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "could not be completed",
  );
  await page.getByLabel("Authentication code").fill(totp(manualKey));
  await page.getByLabel("Authentication code").press("Enter");
  await expect(page).toHaveURL(/\/settings\/sessions/);

  // A backup code completes a fresh pre-auth challenge without being rejected
  // by the TOTP replay marker created immediately above.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/two-factor/);
  const provisionalCookies = await page.context().cookies();
  expect(
    provisionalCookies.some((cookie) => cookie.name === "smarthire.pre-auth"),
  ).toBe(true);
  expect(
    provisionalCookies.some((cookie) => cookie.name === "smarthire.session"),
  ).toBe(false);
  await selectBackupCode(page);
  await page.getByLabel("Backup code").fill(backupCode);
  const backupCompletion = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/complete") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify" }).click();
  const backupResponse = await backupCompletion;
  expect(backupResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/settings\/sessions(?:\?.*)?$/, {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: /^Sessions$/i })).toBeVisible();
  const completedCookies = await page.context().cookies();
  expect(
    completedCookies.some((cookie) => cookie.name === "smarthire.pre-auth"),
  ).toBe(false);
  expect(
    completedCookies.filter((cookie) => cookie.name === "smarthire.session"),
  ).toHaveLength(1);
  await page.goto("/profile/security");
  await expect(page).toHaveURL(/\/settings\/security/);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await selectBackupCode(page);
  await page.getByLabel("Backup code").fill(backupCode);
  await page.getByLabel("Backup code").press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "could not be completed",
  );
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "smarthire.session",
    ),
  ).toBe(false);

  // Establish a fresh authenticated session with a different one-time code.
  await page.getByLabel("Backup code").fill(managementLoginCode);
  const managementLogin = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/complete") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify" }).click();
  expect((await managementLogin).status()).toBe(200);
  await expect(page).toHaveURL(/\/settings\/sessions(?:\?.*)?$/, {
    timeout: 15_000,
  });

  // Regeneration displays ten replacement codes once and invalidates old ones.
  await page.goto("/profile/security");
  const management = page.getByRole("region", {
    name: "Two-factor management",
  });
  await management.getByLabel("Current password").fill(password);
  await management.getByLabel("Six-digit TOTP code").fill(totp(manualKey));
  page.once("dialog", (dialog) => dialog.accept());
  const regeneration = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/backup-codes/regenerate") &&
      response.request().method() === "POST",
  );
  await management.getByRole("button", { name: "Regenerate backup codes" }).click();
  expect((await regeneration).status()).toBe(200);
  await expect(management.getByRole("heading", { name: "Save your ten new backup codes" })).toBeVisible();
  await expect(management.locator("li code")).toHaveCount(10);
  const replacementCode = (await management.locator("li code").first().innerText()).trim();
  expect(await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await management.getByRole("button", { name: "I saved these codes" }).click();
  await expect(management.locator("li code")).toHaveCount(0);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await selectBackupCode(page);
  await page.getByLabel("Backup code").fill(oldCode);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toContainText("could not be completed");
  await page.getByLabel("Backup code").fill(replacementCode);
  const replacementLogin = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/complete") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify" }).click();
  expect((await replacementLogin).status()).toBe(200);
  await expect(page).toHaveURL(/\/settings\/sessions(?:\?.*)?$/, { timeout: 15_000 });

  // Disablement removes the second-factor requirement for the next login.
  await page.goto("/profile/security");
  const disablePanel = page.getByRole("region", { name: "Two-factor management" });
  await disablePanel.getByLabel("Current password").fill(password);
  await disablePanel.getByLabel("Six-digit TOTP code").fill(totp(manualKey));
  page.once("dialog", (dialog) => dialog.accept());
  const disablement = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/identity/two-factor/disable") &&
      response.request().method() === "POST",
  );
  await disablePanel.getByRole("button", { name: "Disable two-factor authentication" }).click();
  expect((await disablement).status()).toBe(200);
  await expect(disablePanel.getByRole("status")).toContainText("disabled");
  await page.goto("/settings/sessions");
  // Better Auth may revoke the current session as part of disablement; when it
  // remains active, explicitly exercise logout before the next login.
  if (await page.getByRole("button", { name: "Sign out" }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Sign out" }).click();
  }
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/two-factor");
  await selectBackupCode(page);
  await page.getByLabel("Backup code").fill(replacementCode);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("status")).toContainText("could not be completed");
});

test("enrollment UI is keyboard-operable and has no 320px overflow", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await registerVerifyAndSignIn(page);

  await page.goto("/profile/security");
  await expect(
    page.getByRole("heading", { name: "Set up two-factor authentication" }),
  ).toBeVisible();

  // Inline validation stays visible and the field is keyboard-focusable.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your current password.")).toBeVisible();
  const enrollmentPanel = page.getByRole("region", {
    name: "Set up two-factor authentication",
  });
  await enrollmentPanel.getByLabel("Current password", { exact: true }).focus();
  await expect(
    enrollmentPanel.getByLabel("Current password", { exact: true }),
  ).toBeFocused();

  // No horizontal overflow at the active project viewport (mobile-320 runs at 320px).
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  // Missing/expired challenge state stays generic, keyboard-operable, and 320px-safe.
  await page.context().clearCookies();
  await page.goto("/two-factor");
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByLabel("Authentication code").press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "could not be completed",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
