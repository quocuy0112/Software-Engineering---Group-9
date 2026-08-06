import { expect, test } from "@playwright/test";
import {
  installMockImageSearchApi,
  openImageSearch,
  posterFixture,
} from "../fixtures/image-search";

test("starts external consent off, explains boundaries, and sends exact consent only when selected", async ({
  page,
}) => {
  const mock = await installMockImageSearchApi(page, "INTENT");
  const input = await openImageSearch(page);
  await expect(page.getByRole("note")).toContainText(
    "deleted within 15 minutes",
  );
  await expect(page.getByRole("note")).toContainText("not used for face");
  const consent = page.getByRole("checkbox", {
    name: /Send recognized text only/u,
  });
  await expect(consent).not.toBeChecked();
  await consent.check();
  await input.setInputFiles(posterFixture());
  await expect(
    page.getByRole("heading", { name: "Review suggested job filters" }),
  ).toBeVisible();
  const reservation = mock.requests.find(
    (request) =>
      request.method === "POST" && request.path === "/api/jobs/image-searches",
  );
  expect(reservation?.body).toMatchObject({
    interpreterClass: "EXTERNAL_OPENAI",
    consent: {
      provider: "openai",
      model: "gpt-5.4-mini-2026-03-17",
      purposeVersion: "job-image-search-purpose-v1",
      noticeVersion: "image-search-notice-v1",
      consentTextVersion: "image-search-consent-v1",
      retentionDisclosureVersion: "image-search-retention-v1",
    },
  });
});

test("reload loses private in-memory results and never persists authority in URL/storage", async ({
  page,
}) => {
  const mock = await installMockImageSearchApi(page, "FALLBACK");
  const input = await openImageSearch(page);
  await input.setInputFiles(posterFixture());
  await expect(page.getByLabel("Recognized job poster text")).toBeVisible();
  expect(page.url()).not.toContain(mock.queryId);
  expect(page.url()).not.toContain(mock.capability);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain(mock.capability);
  await page.reload();
  await expect(page.getByLabel("Recognized job poster text")).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: /Send recognized text only/u }),
  ).not.toBeChecked();
});
