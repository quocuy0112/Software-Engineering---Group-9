import { expect, test, type Page } from "@playwright/test";

async function useEnglish(page: Page) {
  await page.getByLabel(/^(?:Home language|Ngôn ngữ trang chủ)$/u).selectOption("en");
}

test("guests are directed to sign in before opening the private Support Workspace", async ({
  page,
}) => {
  await page.goto("/support");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fsupport/u);
});

test("guests can use the public Help & support centre", async ({ page }) => {
  await page.goto("/help");
  await useEnglish(page);

  await expect(
    page.getByRole("heading", { name: "Frequently Asked Questions" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    page.getByRole("link", { name: "Create a support request" }),
  ).toHaveAttribute("href", "/login?returnTo=%2Fsupport");
  await expect(page).not.toHaveURL(/\/login/u);
});

for (const [path, heading] of [
  ["/legal/privacy", "Privacy at SmartHire"],
  ["/legal/terms", "Using SmartHire"],
  ["/legal/cookies", "Cookies and local storage"],
] as const) {
  test(`guests can read ${path}`, async ({ page }) => {
    await page.goto(path);
    await useEnglish(page);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(
      page.getByRole("link", { name: "Open Help & support" }),
    ).toHaveAttribute("href", "/help");
    await expect(page).not.toHaveURL(/\/login/u);
  });
}
