import { expect, test } from "@playwright/test";
import {
  installMockImageSearchApi,
  openImageSearch,
  posterFixture,
} from "../fixtures/image-search";

test("does not copy OCR fallback text into search when AI filters are unavailable", async ({
  page,
}) => {
  await installMockImageSearchApi(page, "FALLBACK");
  const input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(
    page.getByRole("heading", {
      name: "AI filter suggestions are unavailable",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Recognized job poster text")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to Find jobs" }).click();
  await expect(page).toHaveURL(/\/jobs$/u);
  await expect(
    page.getByRole("searchbox", {
      name: "Search jobs, skills, or companies",
    }),
  ).toHaveValue("");
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
