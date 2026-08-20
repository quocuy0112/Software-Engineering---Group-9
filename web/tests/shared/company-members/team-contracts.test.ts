import { describe, expect, it } from "vitest";
import { teamAcceptSchema, teamInviteSchema, teamMembershipCommandSchema } from "@/shared/contracts/company-members/team";
describe("company team contracts",()=>{
 it("allows only managed invitation roles",()=>{expect(teamInviteSchema.safeParse({email:"a@example.com",role:"RECRUITER"}).success).toBe(true);expect(teamInviteSchema.safeParse({email:"a@example.com",role:"OWNER"}).success).toBe(false)});
 it("requires a role only for role changes",()=>{expect(teamMembershipCommandSchema.safeParse({action:"role"}).success).toBe(false);expect(teamMembershipCommandSchema.safeParse({action:"suspend",role:"RECRUITER"}).success).toBe(false)});
 it("bounds acceptance tokens",()=>expect(teamAcceptSchema.safeParse({token:"x".repeat(32)}).success).toBe(true));
});
