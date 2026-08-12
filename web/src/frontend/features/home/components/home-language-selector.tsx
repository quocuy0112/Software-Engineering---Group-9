"use client";

import { useHomeLocale } from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";

export function HomeLanguageSelector() {
  const { locale, setLocale } = useHomeLocale();
  const copy = homeCopy[locale];
  return (
    <label className="home-language">
      <span className="sr-only">{copy.navigation.language}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as "vi" | "en")}
        aria-label={copy.navigation.language}
      >
        <option value="vi">{copy.navigation.vietnameseCode}</option>
        <option value="en">{copy.navigation.englishCode}</option>
      </select>
    </label>
  );
}
