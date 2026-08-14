"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHomeLocale } from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";
import {
  buildHomeJobSearch,
  type HomeSearchDraft,
} from "../home-search-config";

export function HomeHeroSearch() {
  const router = useRouter();
  const { locale, searchDraft, setSearchDraft } = useHomeLocale();
  const [error, setError] = useState("");
  const copy = homeCopy[locale];
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
      <button className="home-button home-hero-search-button" type="submit">
        {copy.hero.search}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
