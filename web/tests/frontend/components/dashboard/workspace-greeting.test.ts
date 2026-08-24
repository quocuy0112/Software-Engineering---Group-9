import { describe, expect, it } from "vitest";
import {
  getAccountInitials,
  getCandidateGreetingName,
} from "@/frontend/features/dashboard/components/workspace-greeting";

describe("candidate workspace greeting", () => {
  it.each([
    ["Quốc Uy", "Uy"],
    ["  Nguyễn   Quốc   Uy  ", "Uy"],
    ["Avery", "Avery"],
    ["", ""],
    ["   ", ""],
  ])("uses the final name part for %j", (name, expected) => {
    expect(getCandidateGreetingName(name)).toBe(expected);
  });

  it("uses a compact initial fallback for the account chip", () => {
    expect(getAccountInitials("Quốc Uy")).toBe("QU");
    expect(getAccountInitials("  Avery ")).toBe("A");
    expect(getAccountInitials("   ")).toBe("SH");
  });

  it("provides the same short name for the greeting and account chip", () => {
    const accountName = "Nguyễn Quốc Uy";
    expect(getCandidateGreetingName(accountName)).toBe("Uy");
  });
});
