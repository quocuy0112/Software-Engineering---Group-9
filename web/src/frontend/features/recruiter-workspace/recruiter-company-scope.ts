"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { RecruiterCompanyView } from "@/shared/contracts/recruiter-job-posting";

export const ALL_RECRUITER_COMPANIES = "all";
export const RECRUITER_COMPANY_SCOPE_STORAGE_KEY =
  "smarthire-recruiter-company-scope-v1";
const RECRUITER_COMPANY_SCOPE_CHANGED_EVENT =
  "smarthire:recruiter-company-scope-changed";

type CompanyIdentity = Pick<RecruiterCompanyView, "id">;

function readStoredCompanyId(companyIds: readonly string[]) {
  try {
    const stored = window.sessionStorage.getItem(
      RECRUITER_COMPANY_SCOPE_STORAGE_KEY,
    );
    if (stored === ALL_RECRUITER_COMPANIES) return stored;
    if (stored && companyIds.includes(stored)) return stored;
    return ALL_RECRUITER_COMPANIES;
  } catch {
    return ALL_RECRUITER_COMPANIES;
  }
}

function writeStoredCompanyId(companyId: string) {
  try {
    window.sessionStorage.setItem(
      RECRUITER_COMPANY_SCOPE_STORAGE_KEY,
      companyId,
    );
  } catch {
    // Session storage can be unavailable in privacy-restricted browsers.
  }
}

function subscribeToCompanyScope(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === RECRUITER_COMPANY_SCOPE_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(RECRUITER_COMPANY_SCOPE_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(RECRUITER_COMPANY_SCOPE_CHANGED_EVENT, listener);
  };
}

export function useRecruiterCompanyScope(
  companies: readonly CompanyIdentity[],
) {
  const companyIds = useMemo(
    () => companies.map((company) => company.id),
    [companies],
  );
  const multipleCompanies = companyIds.length > 1;
  const getSnapshot = useCallback(
    () =>
      multipleCompanies
        ? readStoredCompanyId(companyIds)
        : ALL_RECRUITER_COMPANIES,
    [companyIds, multipleCompanies],
  );
  const storedSelection = useSyncExternalStore(
    subscribeToCompanyScope,
    getSnapshot,
    () => ALL_RECRUITER_COMPANIES,
  );

  const setCompanyId = useCallback(
    (nextCompanyId: string) => {
      const next =
        multipleCompanies && companyIds.includes(nextCompanyId)
          ? nextCompanyId
          : ALL_RECRUITER_COMPANIES;
      writeStoredCompanyId(next);
      window.dispatchEvent(new Event(RECRUITER_COMPANY_SCOPE_CHANGED_EVENT));
    },
    [companyIds, multipleCompanies],
  );

  return {
    companyId: multipleCompanies ? storedSelection : ALL_RECRUITER_COMPANIES,
    selectedCompanyId:
      multipleCompanies && storedSelection !== ALL_RECRUITER_COMPANIES
        ? storedSelection
        : null,
    multipleCompanies,
    setCompanyId,
  };
}

export function companyMatchesScope(
  companyId: string,
  selectedCompanyId: string | null,
) {
  return !selectedCompanyId || companyId === selectedCompanyId;
}
