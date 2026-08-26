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
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </label>
  );
}
