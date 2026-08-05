"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "smarthire-theme";

const defaultThemeContext: ThemeContextValue = {
  theme: "light",
  toggleTheme: () => undefined,
};

const ThemeContext = createContext<ThemeContextValue>(defaultThemeContext);
let clientTheme: Theme = "light";
let clientThemeInitialized = false;
const themeListeners = new Set<() => void>();

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function getPreferredTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(storedTheme)) return storedTheme;
  } catch {
    // Privacy settings can make localStorage unavailable. The system theme
    // remains a safe, useful fallback in that case.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function getClientTheme(): Theme {
  if (!clientThemeInitialized) {
    clientTheme = getPreferredTheme();
    clientThemeInitialized = true;
  }
  return clientTheme;
}

function getServerTheme(): Theme {
  return "light";
}

function updateTheme(theme: Theme) {
  clientTheme = theme;
  clientThemeInitialized = true;
  themeListeners.forEach((listener) => listener());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getClientTheme,
    getServerTheme,
  );

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme switching still works for the current session without storage.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    updateTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
