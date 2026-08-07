import { expect, test } from "@playwright/test";
import {
  installMockImageSearchApi,
  openImageSearch,
  posterFixture,
} from "../fixtures/image-search";

test("preserves manual criteria and applies editable image proposals through the public job URL", async ({
  page,
}) => {
  const mock = await installMockImageSearchApi(page, "INTENT");
  const input = await openImageSearch(page, "/jobs?q=manual");
  await input.setInputFiles(posterFixture());
  await expect(
    page.getByRole("heading", { name: "Review suggested job filters" }),
  ).toBeVisible();
  await expect(page.getByText("High confidence")).toBeVisible();
  await page.getByRole("button", { name: "Apply selected filters" }).click();
  await expect(page).toHaveURL(/q=manual/u);
  await expect(page).toHaveURL(/workArrangement=REMOTE/u);
  expect(page.url()).not.toContain(mock.queryId);
  expect(page.url()).not.toContain(mock.capability);
  await expect(page.getByRole("search", { name: "Job search" })).toBeVisible();
});

test("keeps ordinary search usable when admission is rate limited", async ({
  page,
}) => {
  await installMockImageSearchApi(page, "RATE_LIMITED");
  const input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(page.getByRole("alert")).toContainText("Try again after");
  await expect(page.getByRole("search", { name: "Job search" })).toBeVisible();
});
