export type RegistryLookupOutcome =
  | "MATCHED"
  | "PARTIAL"
  | "NOT_FOUND"
  | "UNAVAILABLE";

export type EmployerVerificationPreparationResponse = {
  data: {
    preparationId: string | null;
    version: number;
    lookup: null | {
      snapshotId: string;
      taxIdentifier: string;
      outcome: RegistryLookupOutcome;
      sourceLabel: "VietQR" | "Manual fallback";
      checkedAt: string;
      expiresAt: string;
      facts: {
        legalName: string | null;
        registeredAddress: string | null;
        establishmentDate: string | null;
        legalStatus: string | null;
        entityType: string | null;
      };
    };
    email: {
      status: "NONE" | "PENDING" | "VERIFIED" | "EXPIRED";
      maskedEmail?: string | null;
      verifiedAt?: string | null;
      expiresAt?: string | null;
    };
    draft: Record<string, string | boolean | null>;
  };
};
