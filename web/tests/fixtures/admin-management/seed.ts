import { adminFixture, accountFixture, companyFixture, membershipFixture } from "./fixtures";

export function feature006Seed() {
  return {
    administrators: [adminFixture()],
    accounts: [accountFixture()],
    companies: [companyFixture()],
    memberships: [membershipFixture()],
  };
}
