"use client";

import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { getCompanyCopy } from "./i18n/company-copy";

type CompanyPaginationProps = Readonly<{
  page: number;
  total: number;
  totalPages: number;
  pageSize: number;
  itemLabel: string;
  ariaLabel: string;
  hrefForPage?: (page: number) => string;
  onPageChange?: (page: number) => void;
  disabled?: boolean;
}>;

function pageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const first = Math.max(1, currentPage - 1);
  const last = Math.min(totalPages, Math.max(currentPage + 1, 3));
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function controlContent(icon: string, label: string) {
  return (
    <>
      <span aria-hidden="true">{icon}</span>
      <span className="job-pagination-control-label">{label}</span>
    </>
  );
}

export function CompanyPagination({
  page,
  total,
  totalPages,
  pageSize,
  itemLabel,
  ariaLabel,
  hrefForPage,
  onPageChange,
  disabled = false,
}: CompanyPaginationProps) {
  const copy = getCompanyCopy(useWorkspaceLocale());
  if (totalPages <= 1) return null;

  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = total ? Math.min(page * pageSize, total) : 0;
  const goToPage = (nextPage: number) => {
    if (!disabled && nextPage !== page) onPageChange?.(nextPage);
  };

  function renderControl(
    targetPage: number,
    label: string,
    icon: string,
    isDisabled: boolean,
  ) {
    const unavailable = disabled || isDisabled;
    if (hrefForPage) {
      if (unavailable) {
        return (
          <span
            className="job-pagination-control is-disabled"
            aria-disabled="true"
            aria-label={label}
          >
            {controlContent(icon, label)}
          </span>
        );
      }
      return (
        <Link
          className="job-pagination-control"
          href={hrefForPage(targetPage)}
          aria-label={label}
          title={label}
        >
          {controlContent(icon, label)}
        </Link>
      );
    }

    return (
      <button
        className="job-pagination-control"
        type="button"
        disabled={unavailable}
        aria-label={label}
        title={label}
        onClick={() => goToPage(targetPage)}
      >
        {controlContent(icon, label)}
      </button>
    );
  }

  return (
    <nav
      className="job-pagination job-pagination--compact"
      aria-label={ariaLabel}
    >
      <div className="job-pagination-summary">
        <span>
          {copy.paginationShowing}{" "}
          <strong>
            {start}-{end}
          </strong>{" "}
          {copy.paginationOf} <strong>{total}</strong> {itemLabel}
        </span>
      </div>
      {renderControl(1, copy.firstPage, "«", page === 1)}
      {renderControl(page - 1, copy.previousPage, "‹", page === 1)}
      <div className="job-pagination-pages">
        <ol>
          {pageNumbers(page, totalPages).map((number) => {
            const current = number === page;
            if (hrefForPage) {
              return (
                <li key={number}>
                  {current ? (
                    <span
                      className="job-pagination-page is-current"
                      aria-current="page"
                    >
                      {number}
                    </span>
                  ) : (
                    <Link
                      className="job-pagination-page"
                      href={hrefForPage(number)}
                      aria-label={`${copy.paginationPage} ${number}`}
                    >
                      {number}
                    </Link>
                  )}
                </li>
              );
            }
            return (
              <li key={number}>
                <button
                  className={`job-pagination-page${current ? "is-current" : ""}`}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  aria-label={`${copy.paginationPage} ${number}`}
                  disabled={disabled}
                  onClick={() => goToPage(number)}
                >
                  {number}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {renderControl(page + 1, copy.nextPage, "›", page === totalPages)}
      {renderControl(totalPages, copy.lastPage, "»", page === totalPages)}
      <p className="job-pagination-progress" aria-live="polite">
        {copy.paginationPage} {page} / {totalPages}
      </p>
    </nav>
  );
}
