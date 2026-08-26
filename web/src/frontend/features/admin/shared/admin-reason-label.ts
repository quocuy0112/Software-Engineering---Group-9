export const privilegedReasonCategories = [
  "SECURITY_COMPROMISE",
  "POLICY_VIOLATION",
  "USER_REQUEST",
  "VERIFICATION_FAILURE",
  "INCIDENT_RESOLVED",
  "ACCESS_CLEANUP",
  "OTHER",
] as const;

const labels: Record<string, string> = {
  SECURITY_COMPROMISE: "Security compromise",
  POLICY_VIOLATION: "Policy violation",
  USER_REQUEST: "User request",
  VERIFICATION_FAILURE: "Verification failure",
  INCIDENT_RESOLVED: "Incident resolved",
  ACCESS_CLEANUP: "Access cleanup",
  DOCUMENT_UNREADABLE: "Document is unreadable",
  TAX_ID_MISMATCH: "Tax ID does not match",
  DOCUMENT_EXPIRED: "Document has expired",
  COMPANY_INFORMATION_MISMATCH: "Company information does not match",
  DUPLICATE_OR_CONFLICTING_REQUEST: "Duplicate or conflicting request",
  POLICY_INELIGIBLE: "Not eligible under policy",
  OTHER: "Other",
};

export function adminReasonLabel(value: string) {
  return (
    labels[value] ??
    value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/gu, (letter) => letter.toUpperCase())
  );
}
