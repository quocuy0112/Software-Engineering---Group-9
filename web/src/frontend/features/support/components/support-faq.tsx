"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  getSupportHelpCopy,
  type SupportFaqCategory,
} from "../support-help-copy";

type FilterCategory = "all" | SupportFaqCategory;
type Feedback = "positive" | "negative";

const categoryOrder: readonly SupportFaqCategory[] = [
  "account",
  "profile",
  "jobs",
  "match",
  "connections",
  "security",
];

export function SupportFaq({
  locale,
  supportRequestHref = "/support",
}: {
  locale: WorkspaceLocale;
  /**
   * Public help can reuse this FAQ while keeping the case workspace private.
   */
  supportRequestHref?: string;
}) {
  const copy = getSupportHelpCopy(locale);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterCategory>("all");
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const questions = useMemo(
    () =>
      copy.questions.filter((entry) => {
        if (category !== "all" && entry.category !== category) return false;
        if (!normalizedQuery) return true;
        return [
          entry.question,
          entry.answer,
          copy.categories[entry.category],
          ...entry.keywords,
        ]
          .join(" ")
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery);
      }),
    [category, copy, locale, normalizedQuery],
  );
  const popularQuestions = copy.popularQuestionIds
    .map((id) => copy.questions.find((entry) => entry.id === id))
    .filter((entry): entry is (typeof copy.questions)[number] =>
      Boolean(entry),
    );

  function openQuestion(id: string) {
    setOpenQuestionId(id);
    window.requestAnimationFrame(() =>
      document
        .getElementById(`support-faq-question-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setOpenQuestionId(null);
  }

  return (
    <main className="support-help support-faq">
      <header className="support-help__header">
        <p className="support-help__eyebrow">
          <span aria-hidden="true" />
          {copy.faq.eyebrow}
        </p>
        <h1 id="workspace-page-title">{copy.faq.title}</h1>
        <p>{copy.faq.subtitle}</p>
      </header>

      <label className="support-faq__search" htmlFor="support-faq-search">
        <span className="support-help__sr-only">{copy.faq.searchLabel}</span>
        <SearchIcon />
        <input
          id="support-faq-search"
          type="search"
          value={query}
          placeholder={copy.faq.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <section
        className="support-faq__categories"
        aria-label={copy.faq.categoriesLabel}
      >
        <button
          type="button"
          className="support-faq__category"
          data-category="all"
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
        >
          <span aria-hidden="true" />
          {copy.faq.allCategories}
        </button>
        {categoryOrder.map((item) => (
          <button
            key={item}
            type="button"
            className="support-faq__category"
            data-category={item}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            <span aria-hidden="true" />
            {copy.categories[item]}
          </button>
        ))}
      </section>

      {!normalizedQuery && category === "all" ? (
        <section
          className="support-faq__popular"
          aria-labelledby="support-faq-popular"
        >
          <h2 id="support-faq-popular">{copy.faq.popularHeading}</h2>
          <div>
            {popularQuestions.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="support-faq__popular-card"
                data-category={entry.category}
                onClick={() => openQuestion(entry.id)}
              >
                <FaqCategoryIcon category={entry.category} />
                <span>{entry.question}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section
        className="support-faq__questions"
        aria-labelledby="support-faq-all"
      >
        <h2 id="support-faq-all">{copy.faq.allHeading}</h2>
        {questions.length ? (
          <div className="support-faq__list">
            {questions.map((entry) => {
              const expanded = openQuestionId === entry.id;
              const answerId = `support-faq-answer-${entry.id}`;
              return (
                <article
                  id={`support-faq-question-${entry.id}`}
                  key={entry.id}
                  className="support-faq__item"
                  data-category={entry.category}
                  data-open={expanded}
                >
                  <button
                    type="button"
                    className="support-faq__question"
                    aria-expanded={expanded}
                    aria-controls={answerId}
                    onClick={() =>
                      setOpenQuestionId((current) =>
                        current === entry.id ? null : entry.id,
                      )
                    }
                  >
                    <span>
                      <span className="support-faq__tag">
                        {copy.categories[entry.category]}
                      </span>
                      <span className="support-faq__question-text">
                        {entry.question}
                      </span>
                    </span>
                    <ChevronIcon />
                  </button>
                  <div
                    id={answerId}
                    className="support-faq__answer"
                    hidden={!expanded}
                  >
                    <div>
                      <p>{entry.answer}</p>
                      {entry.action ? (
                        <Link href={entry.action.href}>
                          {entry.action.label}
                        </Link>
                      ) : null}
                      <div className="support-faq__feedback">
                        <span>{copy.faq.feedbackQuestion}</span>
                        <button
                          type="button"
                          aria-label={copy.faq.feedbackPositive}
                          aria-pressed={feedback[entry.id] === "positive"}
                          onClick={() =>
                            setFeedback((current) => ({
                              ...current,
                              [entry.id]: "positive",
                            }))
                          }
                        >
                          <span aria-hidden="true">👍</span>
                        </button>
                        <button
                          type="button"
                          aria-label={copy.faq.feedbackNegative}
                          aria-pressed={feedback[entry.id] === "negative"}
                          onClick={() =>
                            setFeedback((current) => ({
                              ...current,
                              [entry.id]: "negative",
                            }))
                          }
                        >
                          <span aria-hidden="true">👎</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="support-faq__empty" role="status">
            <SearchIcon />
            <h3>{copy.faq.noResultsTitle}</h3>
            <p>{copy.faq.noResultsCopy}</p>
            <div>
              <button type="button" onClick={clearFilters}>
                {copy.faq.clearFilters}
              </button>
              <Link href={supportRequestHref}>
                {copy.faq.createSupportRequest}
              </Link>
            </div>
          </div>
        )}
      </section>

      <section
        className="support-help__bridge"
        aria-labelledby="support-faq-bridge"
      >
        <h2 id="support-faq-bridge">{copy.faq.noResultsTitle}</h2>
        <p>{copy.faq.noResultsCopy}</p>
        <Link href={supportRequestHref}>
          {copy.faq.createSupportRequest} <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="5.8" />
      <path d="m15.2 15.2 4 4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function FaqCategoryIcon({ category }: { category: SupportFaqCategory }) {
  if (category === "match") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3 1.2 4.1L17 8.3l-3.8 1.2L12 14l-1.2-4.5L7 8.3l3.8-1.2L12 3Z" />
        <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
      </svg>
    );
  }
  if (category === "jobs") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="4" y="7" width="16" height="12" rx="2" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m-11 5h16m-9 0v2h2v-2" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 20.5a5.5 5.5 0 0 1 11 0M18 7v6m-3-3h6" />
    </svg>
  );
}
