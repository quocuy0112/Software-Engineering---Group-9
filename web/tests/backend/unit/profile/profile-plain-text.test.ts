import { describe, expect, it } from "vitest";
import { normalizeProfileMutationText } from "@/backend/services/profile/save-profile-section";

describe("profile plain-text normalization", () => {
  it("removes script/style markup, event handlers, and control characters", () => {
    const result = normalizeProfileMutationText({
      section: "basics",
      baseRevision: 0,
      basics: {
        headline:
          "Kỹ sư <img src=x onerror=globalThis.pwned=true>\u0000<script>pwned()</script>",
        summary: "<style>body{display:none}</style> Xây dựng sản phẩm",
        phone: null,
        location: "Hồ\u0007 Chí Minh",
      },
    });
    if (result.mutation.section !== "basics") {
      throw new Error("Expected a basics mutation.");
    }
    expect(result.mutation.basics).toEqual({
      headline: "Kỹ sư",
      summary: "Xây dựng sản phẩm",
      phone: null,
      location: "Hồ Chí Minh",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /<script|<style|onerror|pwned|display:none/i,
    );
    expect(serialized).not.toContain(String.fromCharCode(0));
  });

  it("preserves Vietnamese diacritics and NFKC-normalizes required text", () => {
    const result = normalizeProfileMutationText({
      section: "experience",
      baseRevision: 0,
      experience: [
        {
          title: "  Ｋỹ sư phần mềm ",
          company: "Công ty Ánh Dương",
          description: "Phát triển nền tảng tuyển dụng",
          startDate: "2025-01-01",
          endDate: null,
          current: true,
        },
      ],
    });
    if (result.mutation.section !== "experience") {
      throw new Error("Expected an experience mutation.");
    }
    expect(result.mutation.experience[0]).toMatchObject({
      title: "Kỹ sư phần mềm",
      company: "Công ty Ánh Dương",
      description: "Phát triển nền tảng tuyển dụng",
    });
  });

  it("returns a safe warning when optional content sanitizes to empty", () => {
    const result = normalizeProfileMutationText({
      section: "basics",
      baseRevision: 0,
      basics: {
        headline: "<script>alert(1)</script>",
        summary: null,
        phone: null,
        location: null,
      },
    });
    if (result.mutation.section !== "basics") {
      throw new Error("Expected a basics mutation.");
    }
    expect(result.mutation.basics.headline).toBeNull();
    expect(result.warnings).toEqual([
      {
        field: "basics.headline",
        message: "Unsafe or empty content was removed.",
      },
    ]);
  });

  it("rejects a required nested field that sanitizes to empty", () => {
    expect(() =>
      normalizeProfileMutationText({
        section: "education",
        baseRevision: 0,
        education: [
          {
            institution: "<script>alert(1)</script>",
            degree: "BSc",
            field: null,
            startDate: "2025-01-01",
            endDate: null,
            current: true,
          },
        ],
      }),
    ).toThrow(/education\.0\.institution/);
  });
});
