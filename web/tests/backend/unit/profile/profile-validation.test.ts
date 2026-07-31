import { describe, expect, it } from "vitest";
import {
  assertCodePointLength,
  assertProfileCollectionCaps,
  normalizeSkillName,
  normalizeSocialUrl,
  validateEducationEntry,
  validateExperienceEntry,
  validateProfilePhone,
  validateUniqueSkills,
  validateUniqueSocialLinks,
} from "@/backend/services/profile/profile-validation";

describe("profile validation", () => {
  it("counts Unicode code points instead of UTF-16 units", () => {
    expect(() =>
      assertCodePointLength("headline", "😀".repeat(200), 200),
    ).not.toThrow();
    expect(() =>
      assertCodePointLength("headline", "😀".repeat(201), 200),
    ).toThrow(/headline/);
  });

  it.each([
    "0912345678",
    "0912 345 678",
    "+84 912 345 678",
    "(028) 3822-1234",
    "+1 (415) 555-2671",
    "1234567",
    "1234 1234 1234 123",
  ])("accepts the exact FR-017 phone grammar: %s", (phone) => {
    expect(validateProfilePhone(phone)).toBe(phone);
  });

  it.each([
    "+84",
    "0912--345-678",
    "+84 912 345 678 ext 9",
    "0912/345/678",
    "+84 (912 345-678",
    "123456",
    "1234 1234 1234 1234",
  ])("rejects invalid FR-017 phone input: %s", (phone) => {
    expect(() => validateProfilePhone(phone)).toThrow(/phone/i);
  });

  it("enforces experience date/current rules against the injected date", () => {
    const today = "2026-07-31";
    expect(
      validateExperienceEntry(
        {
          title: "Engineer",
          company: "SmartHire",
          description: null,
          startDate: today,
          endDate: null,
          current: true,
        },
        today,
      ),
    ).toMatchObject({ current: true, endDate: null });
    for (const entry of [
      {
        title: "Engineer",
        company: "SmartHire",
        description: null,
        startDate: "2026-08-01",
        endDate: null,
        current: true,
      },
      {
        title: "Engineer",
        company: "SmartHire",
        description: null,
        startDate: "2026-01-01",
        endDate: "2026-02-01",
        current: true,
      },
      {
        title: "Engineer",
        company: "SmartHire",
        description: null,
        startDate: "2026-01-01",
        endDate: null,
        current: false,
      },
      {
        title: "Engineer",
        company: "SmartHire",
        description: null,
        startDate: "2026-05-01",
        endDate: "2026-04-01",
        current: false,
      },
    ]) {
      expect(() => validateExperienceEntry(entry, today)).toThrow();
    }
  });

  it("permits future expected education completion only for current study", () => {
    const today = "2026-07-31";
    expect(
      validateEducationEntry(
        {
          institution: "University",
          degree: "BSc",
          field: "Software Engineering",
          startDate: "2025-01-01",
          endDate: "2027-01-01",
          current: true,
        },
        today,
      ),
    ).toMatchObject({ current: true, endDate: "2027-01-01" });
    expect(() =>
      validateEducationEntry(
        {
          institution: "University",
          degree: "BSc",
          field: null,
          startDate: "2025-01-01",
          endDate: "2027-01-01",
          current: false,
        },
        today,
      ),
    ).toThrow();
  });

  it("canonicalizes safe web URLs and rejects credentials or schemes", () => {
    expect(normalizeSocialUrl("HTTPS://Example.COM:443/profile")).toBe(
      "https://example.com/profile",
    );
    expect(() =>
      normalizeSocialUrl("https://user:secret@example.com/profile"),
    ).toThrow();
    expect(() => normalizeSocialUrl("javascript:alert(1)")).toThrow();
    expect(() => normalizeSocialUrl("ftp://example.com/profile")).toThrow();
    expect(() =>
      validateUniqueSocialLinks([
        "https://example.com/profile",
        "HTTPS://EXAMPLE.COM:443/profile",
      ]),
    ).toThrow(/duplicate/i);
  });

  it("normalizes skills deterministically and rejects normalized duplicates", () => {
    expect(normalizeSkillName("  ＴypeScript   Nâng cao ")).toEqual({
      displayName: "TypeScript Nâng cao",
      normalizedName: "typescript nâng cao",
    });
    expect(() =>
      validateUniqueSkills([" TypeScript ", "ＴＹＰＥＳＣＲＩＰＴ"]),
    ).toThrow(/duplicate/i);
  });

  it("enforces all collection caps", () => {
    expect(() =>
      assertProfileCollectionCaps({
        skills: Array.from({ length: 51 }, () => "x"),
        experience: [],
        education: [],
        socialLinks: [],
      }),
    ).toThrow(/skills/i);
    expect(() =>
      assertProfileCollectionCaps({
        skills: [],
        experience: [],
        education: [],
        socialLinks: Array.from({ length: 11 }, () => "x"),
      }),
    ).toThrow(/socialLinks/i);
  });
});
