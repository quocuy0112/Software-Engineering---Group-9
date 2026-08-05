"use client";

import { useTheme } from "@/frontend/providers/theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const switchingTo = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${switchingTo} mode`;

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
      onClick={toggleTheme}
    >
      <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
          </>
        ) : (
          <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
        )}
      </svg>
      <span className={compact ? "sr-only" : "theme-toggle-label"}>
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}
