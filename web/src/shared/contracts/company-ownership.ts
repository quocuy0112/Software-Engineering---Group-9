/** Maximum number of active companies a single account may own. */
export const MAX_OWNED_COMPANIES_PER_USER = 3 as const;

export const OWNER_COMPANY_LIMIT_REACHED =
  "OWNER_COMPANY_LIMIT_REACHED" as const;

export function isOwnerCompanyRole(role: string | null | undefined) {
  return role === "OWNER";
}
