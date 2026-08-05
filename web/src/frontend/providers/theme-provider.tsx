"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "smarthire_theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): "light" | "dark" {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  // Keep the server and first client render identical. The root layout's
  // initializer handles the background before hydration; this state catches
  // up immediately in the effect below.
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(stored)) {
        // Persisted preferences are hydrated after the client mounts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState(stored);
      }
    } catch {
      // Ignore storage errors
    }
    // The inline root initializer has already selected the correct visual
    // theme; wait until the stored preference is known before reapplying it.
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;

    const root = document.documentElement;
    const mediaQuery =
      theme === "system" && typeof window.matchMedia === "function"
        ? window.matchMedia(SYSTEM_THEME_QUERY)
        : null;

    const applyTheme = () => {
      const activeTheme: "light" | "dark" =
        theme === "system" ? getSystemTheme() : theme;

      setResolvedTheme(activeTheme);
      root.dataset.theme = activeTheme;
      root.classList.toggle("dark", activeTheme === "dark");
    };

    applyTheme();

    if (!mediaQuery) return;

    const handleChange = () => applyTheme();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preferenceLoaded, theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return a safe fallback if used outside ThemeProvider
    return {
      theme: "system" as Theme,
      resolvedTheme: "light" as const,
      setTheme: () => {},
    };
  }
  return context;
}
