import { expect, test } from "@playwright/test";
import {
  installMockImageSearchApi,
  openImageSearch,
  posterFixture,
} from "../fixtures/image-search";

test("offers consume-once OCR text when interpretation is unavailable", async ({
  page,
}) => {
  await installMockImageSearchApi(page, "FALLBACK");
  const input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(page.getByLabel("Recognized job poster text")).toHaveValue(
    "TypeScript remote engineer",
  );
  await page.getByRole("button", { name: "Use as keyword search" }).click();
  await expect(page).toHaveURL(/q=TypeScript\+remote\+engineer/u);
});

test("cancel and OCR failure return control to manual search", async ({
  page,
}) => {
  const hold = await installMockImageSearchApi(page, "HOLD");
  let input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(
    page.getByRole("button", { name: "Cancel image search" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel image search" }).click();
  await expect
    .poll(() => hold.requests.some((request) => request.method === "DELETE"))
    .toBe(true);

  await page.unrouteAll({ behavior: "wait" });
  await installMockImageSearchApi(page, "OCR_FAILED");
  input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(page.getByRole("alert")).toContainText("search manually");
  await expect(page.getByRole("search", { name: "Job search" })).toBeVisible();
});
