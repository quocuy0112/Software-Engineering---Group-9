import { expect, test } from "@playwright/test";
import axe from "axe-core";

const axeSource = axe.source;

test.describe("administrator keyboard and automated accessibility", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.ADMIN_E2E_READY !== "1",
      "requires authenticated Feature 006 browser fixtures",
    ),
  );

  for (const route of [
    "/",
    "/#/accounts",
    "/#/company-memberships",
    "/#/verification-requests",
    "/#/moderation-reports",
  ]) {
    test(`${route} has zero serious or critical axe findings`, async ({
      page,
    }) => {
      await page.goto(`${process.env.ADMIN_E2E_ORIGIN}${route}`);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const result = await (
          window as unknown as {
            axe: {
              run(): Promise<{ violations: Array<{ impact: string | null }> }>;
            };
          }
        ).axe.run();
        return result.violations.filter(
          (item) => item.impact === "serious" || item.impact === "critical",
        );
      });
      expect(violations).toEqual([]);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
    });
  }
});
