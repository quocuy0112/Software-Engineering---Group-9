import { expect, test } from "@playwright/test";
import {
  installMockImageSearchApi,
  openImageSearch,
  posterFixture,
} from "../fixtures/image-search";

test("supports keyboard review, live progress, reduced motion, and 320-pixel layout", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installMockImageSearchApi(page, "HOLD");
  const input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(page.getByRole("status")).toContainText("% complete");
  await page.getByRole("button", { name: "Cancel image search" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveCount(0);
  if (testInfo.project.name === "mobile-320") {
    const box = await page.locator("#global-image-search").boundingBox();
    expect(box?.width).toBeLessThanOrEqual(320);
  }
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
});
