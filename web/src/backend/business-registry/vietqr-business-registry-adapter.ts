import "server-only";
import { z } from "zod";
import { normalizeBusinessPlainText } from "@/shared/contracts/employer-verification/business-verification";
import type {
  BusinessRegistryLookupGateway,
  BusinessRegistryLookupResult,
} from "./business-registry-lookup-gateway";

const responseSchema = z
  .object({
    code: z.string().max(20),
    data: z
      .object({
        id: z.string().max(20),
        name: z.string().max(500).nullable().optional(),
        internationalName: z.string().max(500).nullable().optional(),
        shortName: z.string().max(300).nullable().optional(),
        address: z.string().max(1_000).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export class VietQrBusinessRegistryLookupAdapter
  implements BusinessRegistryLookupGateway
{
  constructor(
    private readonly options: {
      fetcher?: typeof fetch;
      responseLimitBytes: number;
    },
  ) {}

  async lookup(
    taxIdentifier: string,
    signal?: AbortSignal,
  ): Promise<BusinessRegistryLookupResult> {
    try {
      const response = await (this.options.fetcher ?? fetch)(
        `https://api.vietqr.io/v2/business/${encodeURIComponent(taxIdentifier)}`,
        { signal, headers: { accept: "application/json" }, cache: "no-store" },
      );
      if (response.status === 404) return this.notFound();
      if (!response.ok) return this.unavailable();
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > this.options.responseLimitBytes) {
        return this.unavailable();
      }
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > this.options.responseLimitBytes) {
        return this.unavailable();
      }
      const parsed = responseSchema.safeParse(JSON.parse(body));
      if (!parsed.success) return this.unavailable();
      if (parsed.data.code !== "00" || !parsed.data.data) {
        return this.notFound();
      }
      if (parsed.data.data.id.trim() !== taxIdentifier) {
        return this.unavailable();
      }
      const normalize = (value: string | null | undefined, max: number) => {
        if (!value) return null;
        const normalized = normalizeBusinessPlainText(value);
        return normalized && Array.from(normalized).length <= max
          ? normalized
          : null;
      };
      const facts = {
        taxIdentifier,
        legalName: normalize(parsed.data.data.name, 240),
        internationalName: normalize(parsed.data.data.internationalName, 240),
        shortName: normalize(parsed.data.data.shortName, 160),
        registeredAddress: normalize(parsed.data.data.address, 500),
      };
      return {
        providerKey: "vietqr-v2",
        outcome:
          facts.legalName && facts.registeredAddress ? "MATCHED" : "PARTIAL",
        facts,
      };
    } catch {
      return this.unavailable();
    }
  }

  private unavailable(): BusinessRegistryLookupResult {
    return { providerKey: "vietqr-v2", outcome: "UNAVAILABLE", facts: null };
  }

  private notFound(): BusinessRegistryLookupResult {
    return { providerKey: "vietqr-v2", outcome: "NOT_FOUND", facts: null };
  }
}
