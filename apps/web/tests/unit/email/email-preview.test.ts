import { describe, expect, it } from "vitest";
import { renderLocalEmailPreviews } from "@/server/email/preview/index";

describe("local React Email preview", () => {
  it("renders every template without invoking a network adapter", async () => {
    const previews = await renderLocalEmailPreviews();
    expect(previews.map((preview) => preview.name)).toEqual([
      "verify-email",
      "reset-password",
      "password-changed",
    ]);
    for (const preview of previews) {
      expect(preview.html).toContain("SmartHire");
      expect(preview.text.length).toBeGreaterThan(20);
    }
  });
});
