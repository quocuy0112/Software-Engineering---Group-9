import "server-only";

export type BusinessRegistryFacts = {
  taxIdentifier: string;
  legalName: string | null;
  internationalName: string | null;
  shortName: string | null;
  registeredAddress: string | null;
};

export type BusinessRegistryLookupResult = {
  providerKey: string;
  outcome: "MATCHED" | "PARTIAL" | "NOT_FOUND" | "UNAVAILABLE";
  facts: BusinessRegistryFacts | null;
};

export interface BusinessRegistryLookupGateway {
  lookup(
    normalizedTaxIdentifier: string,
    signal?: AbortSignal,
  ): Promise<BusinessRegistryLookupResult>;
}
