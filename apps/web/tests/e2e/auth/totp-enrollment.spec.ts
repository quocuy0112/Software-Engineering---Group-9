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
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
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
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  let link = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mail)).filter((item) => !before.has(item))) {
        const body = await readFile(resolve(mail, name), "utf8");
        if (body.includes(`To: ${email}`)) {
          link = body.match(/http:\/\/localhost:3000\/verify-email\?token=[A-Za-z0-9._~-]+/)?.[0] ?? "";
        }
      }
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/settings\/sessions/);
  return email;
}

test("enrolls TOTP end-to-end: QR, manual key, six-digit verify, and ten one-time backup codes", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}` });
  const email = await registerVerifyAndSignIn(page);

  await page.goto("/settings/security");
  await expect(page.getByRole("heading", { name: "Set up two-factor authentication" })).toBeVisible();

  await page.getByLabel("Current password", { exact: true }).fill(password);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  const enrollmentStart = page.waitForResponse((response) => response.url().endsWith("/api/identity/two-factor/enrollment") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Continue" }).click();
  const startResponse = await enrollmentStart;
  const startBody = (await startResponse.json().catch(() => ({}))) as { message?: string };
  expect(startResponse.status(), `Enrollment start failed (${startResponse.status()}): ${startBody.message ?? "no safe response body"}`).toBe(200);
  expect(startBody.message ?? "").not.toMatch(/password|secret|token|cookie|otpauth/i);

  // Real QR image rendered server-side plus the manual setup key (the base32 secret).
  const qr = page.getByRole("img", { name: /QR code/i });
  await expect(qr).toBeVisible();
  expect(await qr.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByText("Can't scan?")).toBeVisible();

  const manualKey = (await page.locator(".totp-manual code").innerText()).trim();
  expect(manualKey.length).toBeGreaterThan(0);

  await page.getByLabel("Six-digit code").fill(totp(manualKey));
  await page.getByRole("button", { name: "Verify and enable" }).click();

  await expect(page.getByRole("heading", { name: "Save your backup codes" })).toBeVisible();
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
  await expect(page.getByRole("status")).toContainText("could not be completed");
  await page.getByLabel("Authentication code").fill(totp(manualKey));
  await page.getByLabel("Authentication code").press("Enter");
  await expect(page).toHaveURL(/\/settings\/sessions/);
});

test("enrollment UI is keyboard-operable and has no 320px overflow", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await registerVerifyAndSignIn(page);

  await page.goto("/settings/security");
  await expect(page.getByRole("heading", { name: "Set up two-factor authentication" })).toBeVisible();

  // Inline validation stays visible and the field is keyboard-focusable.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your current password.")).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).focus();
  await expect(page.getByLabel("Current password", { exact: true })).toBeFocused();

  // No horizontal overflow at the active project viewport (mobile-320 runs at 320px).
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  // Missing/expired challenge state stays generic, keyboard-operable, and 320px-safe.
  await page.context().clearCookies();
  await page.goto("/two-factor");
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByLabel("Authentication code").press("Enter");
  await expect(page.getByRole("status")).toContainText("could not be completed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
