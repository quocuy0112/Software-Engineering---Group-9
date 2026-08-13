export const professionalConnectionContractManifest = {
  version: "1.0.0",
  adminResource: "professional-connection-proposals",
  paths: [
    "/api/admin/professional-connection-proposals",
    "/api/admin/professional-connection-proposals/{proposalId}",
    "/api/admin/professional-connection-proposals/{proposalId}/cancel",
    "/api/admin/professional-connection-proposals/{proposalId}/protected-audit",
    "/api/connections/proposals",
    "/api/connections/proposals/{proposalId}",
    "/api/connections/proposals/{proposalId}/decision",
    "/api/connections",
    "/api/connections/{connectionId}/disconnect",
    "/api/connections/notifications",
    "/api/connections/notifications/{notificationId}/read",
  ],
} as const;
