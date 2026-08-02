import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  createSyntheticDocx,
  createSyntheticPdf,
} from "../../../helpers/cv-document-buffers";

test.describe.configure({ mode: "serial" });

const password = "Synthetic CV Feature 004!";

async function registerCandidate(
  browser: Browser,
  label: string,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const mailDirectory = resolve(process.cwd(), ".local/mail");
  const before = new Set(await readdir(mailDirectory).catch(() => []));
  await page.goto("/register");
  await page.getByLabel("Full name").fill(`Candidate ${label}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  let verificationLink = "";
  await expect
    .poll(async () => {
      for (const name of (await readdir(mailDirectory)).filter(
        (entry) => !before.has(entry),
      )) {
        const body = await readFile(resolve(mailDirectory, name), "utf8");
        if (body.includes(`To: ${email}`)) {
          verificationLink =
            body.match(
              /http:\/\/localhost:3001\/verify-email\?token=[A-Za-z0-9._~-]+/u,
            )?.[0] ?? "";
        }
      }
      return verificationLink;
    })
    .not.toBe("");
  await page.goto(verificationLink);
  await page.getByRole("link", { name: "Continue to login" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  return page;
}

test("uploads synthetic PDF and DOCX through REVIEW_READY without mutating Profile", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const page = await registerCandidate(browser, "cv-upload");
  const before = await page.request
    .get("/api/account/profile")
    .then((response) => response.json());
  for (const fixture of [
    {
      name: "synthetic.pdf",
      mimeType: "application/pdf",
      buffer: createSyntheticPdf(),
    },
    {
      name: "synthetic.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: createSyntheticDocx(),
    },
  ]) {
    await page.goto("/profile/cv-imports");
    await expect(
      page.getByRole("button", { name: /upload cv/i }),
    ).toBeEnabled();
    await page.getByLabel("CV file").setInputFiles(fixture);
    await expect(
      page.getByRole("status").filter({ hasText: /is ready to upload/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /upload cv/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /review ready/i }),
    ).toBeVisible({ timeout: 90_000 });
    await page.reload();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: new RegExp(`${fixture.name}.*review ready`, "is") }),
    ).toBeVisible();
  }
  const after = await page.request
    .get("/api/account/profile")
    .then((response) => response.json());
  expect(after.revision).toBe(before.revision);
  expect(after).toEqual(before);
});

test("shows replacement guidance and denies a foreign import", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const owner = await registerCandidate(browser, "cv-owner");
  await owner.goto("/profile/cv-imports");
  await expect(owner.getByRole("button", { name: /upload cv/i })).toBeEnabled();
  await owner.getByLabel("CV file").setInputFiles({
    name: "image-only.pdf",
    mimeType: "application/pdf",
    buffer: createSyntheticPdf(""),
  });
  await expect(
    owner.getByRole("status").filter({ hasText: /is ready to upload/i }),
  ).toBeVisible();
  const reservationResponse = owner.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/account/cv-imports",
  );
  await owner.getByRole("button", { name: /upload cv/i }).click();
  const uploadId = String(
    ((await (await reservationResponse).json()) as { uploadId?: unknown })
      .uploadId ?? "",
  );
  await expect(owner.getByText(/replace.*cv/i)).toBeVisible({
    timeout: 90_000,
  });
  expect(uploadId).toBeTruthy();

  const other = await registerCandidate(browser, "cv-other");
  const denied = await other.request.get(`/api/account/cv-imports/${uploadId}`);
  expect(denied.status()).toBe(404);
});
