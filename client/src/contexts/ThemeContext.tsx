import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";

export type Appearance = "light";
export type ThemeName = "minimal" | "ivory" | "charcoal" | "soft-stone";

type ThemeContextType = {
  theme: "light";
  appearance: Appearance;
  resolvedAppearance: "light";
  themeName: ThemeName;
  setAppearance: (appearance: Appearance) => void;
  setThemeName: (theme: ThemeName) => void;
  toggleTheme: () => void;
  switchable: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const APPEARANCE_KEY = "fitcheck-appearance";
const THEME_KEY = "fitcheck-theme";

function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "minimal";
  const value = window.localStorage.getItem(THEME_KEY);
  return value === "ivory" || value === "charcoal" || value === "soft-stone" ? value : "minimal";
}

export function ThemeProvider({ children, switchable = true }: { children: React.ReactNode; defaultTheme?: "light" | "dark"; switchable?: boolean }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(readStoredTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = "light";
    root.dataset.theme = themeName;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    window.localStorage.setItem(APPEARANCE_KEY, "light");
    window.localStorage.setItem(THEME_KEY, themeName);
  }, [themeName]);

  const value = useMemo<ThemeContextType>(() => ({
    theme: "light",
    appearance: "light",
    resolvedAppearance: "light",
    themeName,
    setAppearance: () => undefined,
    setThemeName: (next) => setThemeNameState(next),
    // Kept as a no-op for shared showcase components; FitCheck itself is light-only.
    toggleTheme: () => undefined,
    switchable,
  }), [themeName, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
