import { describe, expect, it } from "vitest";

import {
  validateSameOrigin,
  validateSameOriginRead,
} from "@/backend/security/csrf/csrf";

const trustedOrigin = "https://app.example.test";

function readRequest(headers: HeadersInit) {
  return new Request(`${trustedOrigin}/api/jobs/image-searches/query-id`, {
    headers,
  });
}

describe("image-search request origin policy", () => {
  it("accepts a same-origin read when the browser omits Origin", () => {
    const request = readRequest({ "sec-fetch-site": "same-origin" });

    expect(validateSameOriginRead(request, trustedOrigin)).toBe(true);
    expect(validateSameOrigin(request, trustedOrigin)).toBe(false);
  });

  it("accepts an exact Origin when a same-origin read includes it", () => {
    const request = readRequest({
      origin: trustedOrigin,
      "sec-fetch-site": "same-origin",
    });

    expect(validateSameOriginRead(request, trustedOrigin)).toBe(true);
  });

  it.each([
    { origin: undefined, site: "cross-site" },
    { origin: "https://evil.example.test", site: "same-origin" },
    { origin: "https://evil.example.test", site: "cross-site" },
  ])("rejects an untrusted read: $origin $site", ({ origin, site }) => {
    const headers = new Headers({ "sec-fetch-site": site });
    if (origin) headers.set("origin", origin);

    expect(validateSameOriginRead(readRequest(headers), trustedOrigin)).toBe(
      false,
    );
  });
});
