"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { CompanyCard } from "@/shared/contracts/company";
import { CompanyPagination } from "./company-pagination";
import styles from "./candidate-company-screen.module.css";
import { getCompanyCopy } from "./i18n/company-copy";

export function CompanyListScreen({
  companies,
  total,
  page = 1,
  totalPages = 1,
  initialQuery = "",
  initialLimit = 24,
}: {
  companies: readonly CompanyCard[];
  total: number;
  page?: number;
  totalPages?: number;
  initialQuery?: string;
  initialLimit?: number;
}) {
  const copy = getCompanyCopy(useWorkspaceLocale());
  const hasQuery = Boolean(initialQuery.trim());
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (hasQuery) params.set("q", initialQuery.trim());
    if (nextPage > 1) params.set("page", String(nextPage));
    if (initialLimit !== 24) params.set("limit", String(initialLimit));
    const query = params.toString();
    return query ? `/company?${query}` : "/company";
  };

  return (
    <main className={styles.page} aria-labelledby="company-list-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{copy.candidateWorkspace}</p>
          <h1 id="company-list-title">{copy.companies}</h1>
          <p>{copy.discoverDescription}</p>
        </div>
        <span className={styles.count} aria-label={copy.companyCount(total)}>
          {copy.companyCount(total)}
        </span>
      </header>
      <form
        className={styles.companySearch}
        action="/company"
        method="get"
        role="search"
        aria-label={copy.searchCompanies}
      >
        <label className={styles.companySearchField}>
          <span>{copy.searchCompanies}</span>
          <input
            className={styles.input}
            name="q"
            defaultValue={initialQuery}
            placeholder={copy.companySearchPlaceholder}
            type="search"
          />
        </label>
        <button className={styles.button} type="submit">
          {copy.search}
        </button>
        {hasQuery ? (
          <Link
            className={`${styles.button} ${styles.secondary}`}
            href="/company"
          >
            {copy.clear}
          </Link>
        ) : null}
      </form>
      {companies.length ? (
        <div className={styles.grid} role="list" aria-label={copy.companies}>
          {companies.map((company) => (
            <div
              key={company.companyId}
              className={styles.cardItem}
              role="listitem"
            >
              <Link
                className={styles.card}
                href={`/company/${encodeURIComponent(company.companyId)}`}
              >
                <div className={styles.cardTop}>
                  <CompanyAvatar
                    name={company.name}
                    imageUrl={company.logoUrl}
                    size="lg"
                  />
                </div>
                <h2>{company.name}</h2>
                <p>{company.description}</p>
                <span className={styles.arrow}>
                  {copy.viewCompany} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty} role="status">
          <Building2 size={30} aria-hidden="true" />
          <strong>
            {hasQuery ? copy.noMatchingCompanies : copy.noCompanies}
          </strong>
          <span>
            {hasQuery
              ? copy.noMatchingCompaniesDescription
              : copy.noCompaniesDescription}
          </span>
        </div>
      )}
      <CompanyPagination
        page={page}
        total={total}
        totalPages={totalPages}
        pageSize={initialLimit}
        itemLabel={copy.companies.toLowerCase()}
        ariaLabel={copy.companies}
        hrefForPage={pageHref}
      />
    </main>
  );
}
