// Generated from Feature 009 admin-user-verification.openapi.yaml. Do not edit by hand.
export const adminContractVersion = "0.1.0" as const;
export const adminContractSha256 = "a3459442471ebce00601c47fa26f68bae70ef471f36c02e26eba0172d32db576" as const;
export const adminContractPaths = [
  "/api/admin/accounts",
  "/api/admin/accounts/{accountId}",
  "/api/admin/accounts/{accountId}/suspend",
  "/api/admin/accounts/{accountId}/restore",
  "/api/admin/verification-requests",
  "/api/admin/verification-requests/{requestId}",
  "/api/admin/verification-requests/{requestId}/evidence/{evidenceId}/preview",
  "/api/admin/verification-requests/{requestId}/approve",
  "/api/admin/verification-requests/{requestId}/reject"
] as const;
export const adminRemovedPaths = [
  "/api/admin/accounts/{accountId}/reinstate",
  "/api/admin/verification-requests/{requestId}/request-changes"
] as const;
