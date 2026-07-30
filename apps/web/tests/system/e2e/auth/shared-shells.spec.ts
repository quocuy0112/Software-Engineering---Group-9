import { expect, test } from "@playwright/test";

test("auth shell respects reduced motion and has no 320px overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create your SmartHire account" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".auth-motion")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("security shell retains representative controls at mobile and desktop widths", async ({
  page,
}) => {
  await page.goto("/register");
  await page.locator("main").evaluate((main) => {
    main.setAttribute("class", "security-page");
    const section = main.querySelector("section")!;
    section.setAttribute("class", "security-card");
    section.innerHTML =
      '<h1>Security settings</h1><button type="button">Revoke selected session</button><p role="status">Session remains active</p>';
  });
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("button", { name: "Revoke selected session" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});
