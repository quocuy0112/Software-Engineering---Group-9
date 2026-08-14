import "server-only";
import { businessVerificationConfig } from "@/backend/admin/verification/business-verification-config";
import type { BusinessRegistryLookupGateway } from "./business-registry-lookup-gateway";
import { VietQrBusinessRegistryLookupAdapter } from "./vietqr-business-registry-adapter";

const disabled: BusinessRegistryLookupGateway = {
  async lookup() {
    return {
      providerKey: "disabled-manual-v1",
      outcome: "UNAVAILABLE" as const,
      facts: null,
    };
  },
};

export function selectedBusinessRegistryProvider(): BusinessRegistryLookupGateway {
  if (businessVerificationConfig.provider === "disabled") return disabled;
  return new VietQrBusinessRegistryLookupAdapter({
    responseLimitBytes: businessVerificationConfig.providerResponseLimitBytes,
  });
}
