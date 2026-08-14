import { describe, expect, it, vi } from "vitest";
import { VietQrBusinessRegistryLookupAdapter } from "@/backend/business-registry/vietqr-business-registry-adapter";
import { registryLookupConfirmsBusiness } from "@/shared/contracts/employer-verification/business-verification-responses";

describe("VietQR business registry adapter", () => {
  it("accepts only bounded allowlisted matching fields", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "00",
            data: {
              id: "0316794479",
              name: " CÔNG TY TNHH CASSO ",
              address: "Thành phố Hồ Chí Minh",
              unexpectedPersonalData: "must not escape",
            },
          }),
          { status: 200 },
        ),
    );
    const result = await new VietQrBusinessRegistryLookupAdapter({
      fetcher: fetcher as typeof fetch,
      responseLimitBytes: 65_536,
    }).lookup("0316794479");
    expect(result).toEqual({
      providerKey: "vietqr-v2",
      outcome: "MATCHED",
      facts: {
        taxIdentifier: "0316794479",
        legalName: "CÔNG TY TNHH CASSO",
        internationalName: null,
        shortName: null,
        registeredAddress: "Thành phố Hồ Chí Minh",
      },
    });
    expect(JSON.stringify(result)).not.toContain("unexpectedPersonalData");
  });

  it("maps partial, identifier mismatch, oversized, and unavailable safely", async () => {
    const adapter = (body: BodyInit | null, status = 200, limit = 65_536) =>
      new VietQrBusinessRegistryLookupAdapter({
        fetcher: vi.fn(
          async () => new Response(body, { status }),
        ) as typeof fetch,
        responseLimitBytes: limit,
      });
    expect(
      (
        await adapter(
          JSON.stringify({
            code: "00",
            data: { id: "0316794479", name: "ABC" },
          }),
        ).lookup("0316794479")
      ).outcome,
    ).toBe("PARTIAL");
    expect(
      (
        await adapter(
          JSON.stringify({
            code: "00",
            data: { id: "9999999999", name: "ABC", address: "Address" },
          }),
        ).lookup("0316794479")
      ).outcome,
    ).toBe("UNAVAILABLE");
    expect(
      (await adapter("x".repeat(100), 200, 50).lookup("0316794479")).outcome,
    ).toBe("UNAVAILABLE");
    expect((await adapter(null, 429).lookup("0316794479")).outcome).toBe(
      "UNAVAILABLE",
    );
  });

  it("unlocks progression only when VietQR returned the exact business record", () => {
    expect(registryLookupConfirmsBusiness("MATCHED")).toBe(true);
    expect(registryLookupConfirmsBusiness("PARTIAL")).toBe(true);
    expect(registryLookupConfirmsBusiness("NOT_FOUND")).toBe(false);
    expect(registryLookupConfirmsBusiness("UNAVAILABLE")).toBe(false);
  });
});
