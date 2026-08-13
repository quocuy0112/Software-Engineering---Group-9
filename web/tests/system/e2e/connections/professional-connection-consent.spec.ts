import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.CONNECTION_E2E_READY !== "1",
  "Requires the documented Platform Administrator and two-participant fixture",
);

async function signIn(page: Page, email: string, password: string) {
  const response = await page.request.post("/api/identity/login", {
    headers: {
      origin: "http://localhost:3001",
      "sec-fetch-site": "same-origin",
    },
    data: { email, password, returnTo: "/connections" },
  });
  expect(response.ok()).toBe(true);
}

test("participants independently accept and receive one active connection", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();
    await Promise.all([
      signIn(
        firstPage,
        process.env.CONNECTION_E2E_FIRST_EMAIL!,
        process.env.CONNECTION_E2E_FIRST_PASSWORD!,
      ),
      signIn(
        secondPage,
        process.env.CONNECTION_E2E_SECOND_EMAIL!,
        process.env.CONNECTION_E2E_SECOND_PASSWORD!,
      ),
    ]);
    await Promise.all([
      firstPage.goto("/connections"),
      secondPage.goto("/connections"),
    ]);
    await firstPage.getByRole("button", { name: "Accept" }).click();
    await expect(
      firstPage.getByRole("button", { name: /waiting/i }),
    ).toBeVisible();
    await secondPage.getByRole("button", { name: "Accept" }).click();
    await expect(secondPage.getByText("Messaging enabled")).toBeVisible();
    await firstPage.reload();
    await expect(firstPage.getByText("Messaging enabled")).toBeVisible();
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});

test("decline remains symmetric and does not identify the declining participant", async ({
  page,
}) => {
  await signIn(
    page,
    process.env.CONNECTION_E2E_FIRST_EMAIL!,
    process.env.CONNECTION_E2E_FIRST_PASSWORD!,
  );
  await page.goto("/connections");
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("DECLINED")).toBeVisible();
  await expect(page.getByText(/who declined|blocked by/iu)).toHaveCount(0);
});

test("disconnect archives prior chat as read-only", async ({ page }) => {
  await signIn(
    page,
    process.env.CONNECTION_E2E_FIRST_EMAIL!,
    process.env.CONNECTION_E2E_FIRST_PASSWORD!,
  );
  await page.goto("/connections");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Disconnect" }).click();
  await page.getByRole("link", { name: "View history" }).click();
  await expect(page.getByText(/history is read-only/i)).toBeVisible();
  await expect(page.getByLabel("Message")).toBeDisabled();
});
