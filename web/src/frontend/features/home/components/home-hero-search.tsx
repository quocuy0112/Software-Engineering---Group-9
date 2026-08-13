"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHomeLocale } from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";
import {
  buildHomeJobSearch,
  homeEmploymentTypes,
  homeExperienceLevels,
  homeWorkArrangements,
  type HomeSearchDraft,
} from "../home-search-config";

export function HomeHeroSearch() {
  const router = useRouter();
  const { locale, searchDraft, setSearchDraft } = useHomeLocale();
  const [error, setError] = useState("");
  const copy = homeCopy[locale];
  const filterLabels: Record<string, string> = copy.filters;
  const update = (field: keyof HomeSearchDraft, value: string) =>
    setSearchDraft({ ...searchDraft, [field]: value });
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const params = buildHomeJobSearch(searchDraft);
      router.push(`/jobs${params.size ? `?${params.toString()}` : ""}`);
    } catch {
      setError(copy.hero.invalidSearch);
    }
  }
  const options = (
    values: readonly string[],
    empty: string,
  ) => (
    <>
      <option value="">{empty}</option>
      {values.map((value) => (
        <option key={value} value={value}>{filterLabels[value]}</option>
      ))}
    </>
  );
  return (
    <form className="home-hero-search" onSubmit={submit} noValidate>
      <label>
        <span>{copy.hero.keyword}</span>
        <input
          value={searchDraft.keyword}
          onChange={(event) => update("keyword", event.target.value)}
          placeholder={copy.hero.keywordPlaceholder}
          maxLength={200}
        />
      </label>
      <label>
        <span>{copy.hero.location}</span>
        <input
          value={searchDraft.location}
          onChange={(event) => update("location", event.target.value)}
          placeholder={copy.hero.locationPlaceholder}
          maxLength={160}
        />
      </label>
      <label>
        <span>{copy.hero.arrangement}</span>
        <select value={searchDraft.workArrangement} onChange={(event) => update("workArrangement", event.target.value)}>
          {options(homeWorkArrangements, copy.hero.anyArrangement)}
        </select>
      </label>
      <label>
        <span>{copy.hero.employmentType}</span>
        <select value={searchDraft.employmentType} onChange={(event) => update("employmentType", event.target.value)}>
          {options(homeEmploymentTypes, copy.hero.anyEmploymentType)}
        </select>
      </label>
      <label>
        <span>{copy.hero.experienceLevel}</span>
        <select value={searchDraft.experienceLevel} onChange={(event) => update("experienceLevel", event.target.value)}>
          {options(homeExperienceLevels, copy.hero.anyExperienceLevel)}
        </select>
      </label>
      <label>
        <span>{copy.hero.skills}</span>
        <input
          value={searchDraft.skills}
          onChange={(event) => update("skills", event.target.value)}
          placeholder={copy.hero.skillsPlaceholder}
          maxLength={400}
        />
      </label>
      <button className="home-button home-hero-search-button" type="submit">{copy.hero.search}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
