"use client";

import { ChevronDown } from "lucide-react";
import type { RecruiterCompanyView } from "@/shared/contracts/recruiter-job-posting";
import { ALL_RECRUITER_COMPANIES } from "./recruiter-company-scope";

export function RecruiterCompanyFilter({
  companies,
  value,
  onChange,
  id,
  className,
}: {
  companies: readonly RecruiterCompanyView[];
  value: string;
  onChange: (companyId: string) => void;
  id: string;
  className?: string;
}) {
  if (companies.length < 2) return null;

  const ownedCompanies = companies.filter(
    (company) => company.role === "OWNER",
  );
  const memberCompanies = companies.filter(
    (company) => company.role !== "OWNER",
  );

  return (
    <label
      className={["recruiter-company-filter", className]
        .filter(Boolean)
        .join(" ")}
      htmlFor={id}
    >
      <span>Company</span>
      <span className="recruiter-company-filter__control">
        <select
          id={id}
          name="company"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value={ALL_RECRUITER_COMPANIES}>All companies</option>
          {ownedCompanies.length ? (
            <optgroup label="Owned by you">
              {ownedCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {memberCompanies.length ? (
            <optgroup label="Member access">
              {memberCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </label>
  );
}
