import { describe, expect, it } from "vitest";
import { jobSearchRequestQuery } from "@/app/api/jobs/route";

describe("public job search API query parsing", () => {
  it("preserves every selected district for the discovery service", () => {
    const query = jobSearchRequestQuery(
      new Request(
        "https://smarthire.example/api/jobs?location=B%C3%A0+R%E1%BB%8Ba+-+V%C5%A9ng+T%C3%A0u&district=V%C5%A9ng+T%C3%A0u+City+Center&district=Long+%C4%90i%E1%BB%81n",
      ),
    );

    expect(query).toMatchObject({
      location: "Bà Rịa - Vũng Tàu",
      district: ["Vũng Tàu City Center", "Long Điền"],
    });
  });
});
