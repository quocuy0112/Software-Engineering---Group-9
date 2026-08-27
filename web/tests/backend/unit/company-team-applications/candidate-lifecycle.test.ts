import { describe, expect, it } from "vitest";
import { TeamApplicationCommandError } from "@/backend/services/company-members/team-application-service";

describe("Candidate Team Application lifecycle", () => {
  it("uses an opaque conflict for withdrawal races", () => {
    const error = new TeamApplicationCommandError("TEAM_APPLICATION_CONFLICT");
    expect(error.code).toBe("TEAM_APPLICATION_CONFLICT");
    expect(error.message).toBe("TEAM_APPLICATION_CONFLICT");
  });
});
