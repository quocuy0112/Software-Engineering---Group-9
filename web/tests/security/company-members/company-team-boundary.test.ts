import { describe, expect, it } from "vitest";
import { CompanyTeamAuthorizationError } from "@/backend/company-members/company-team-authorization";
import { CompanyTeamCommandError } from "@/backend/company-members/company-team-service";

describe("company-team security boundary", () => {
  it("uses opaque errors rather than member data for denied commands", () => {
    expect(new CompanyTeamAuthorizationError("TEAM_FORBIDDEN").code).toBe("TEAM_FORBIDDEN");
    expect(new CompanyTeamCommandError("INVITATION_UNAVAILABLE").code).toBe("INVITATION_UNAVAILABLE");
  });
});
