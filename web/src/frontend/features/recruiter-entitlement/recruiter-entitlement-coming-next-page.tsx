"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Entitlement = {
  available: boolean;
  requiresSelection: boolean;
  selectedCompanyId: string | null;
  companies: Array<{ companyId: string; companyName: string; role: string }>;
  destinations: Array<{ label: string; href: string }>;
};
export function RecruiterEntitlementComingNextPage() {
  const [data, setData] = useState<Entitlement>();
  const [selected, setSelected] = useState("");
  async function load(companyId?: string) {
    const response = await fetch(
      `/api/recruiter/entitlement${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    setData(await response.json());
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/recruiter/entitlement", {
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      if (active) setData(await response.json());
    });
    return () => {
      active = false;
    };
  }, []);
  if (!data)
    return (
      <main>
        <p role="status">Checking company access…</p>
      </main>
    );
  return (
    <main className="mx-auto grid min-h-screen max-w-2xl content-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">
        Recruiter workspace is coming next
      </h1>
      {data.companies.length > 1 && (
        <label className="grid gap-2">
          Company context
          <select
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              void load(event.target.value);
            }}
          >
            <option value="">Select a company</option>
            {data.companies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyName} — {company.role}
              </option>
            ))}
          </select>
        </label>
      )}
      {!data.available && (
        <p>
          Recruiter management is unavailable for the current company context.
        </p>
      )}
      <nav aria-label="Available destinations">
        <ul className="grid gap-3">
          {data.destinations.map((item) => (
            <li key={item.label}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
