import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";

export type Appearance = "light" | "dark" | "system";
export type ThemeName = "minimal" | "ivory" | "charcoal" | "soft-stone";

type ThemeContextType = {
  theme: "light" | "dark";
  appearance: Appearance;
  resolvedAppearance: "light" | "dark";
  themeName: ThemeName;
  setAppearance: (appearance: Appearance) => void;
  setThemeName: (theme: ThemeName) => void;
  toggleTheme: () => void;
  switchable: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const APPEARANCE_KEY = "fitcheck-appearance";
const THEME_KEY = "fitcheck-theme";

function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value ? (value as T) : fallback;
}

function systemAppearance(): "light" | "dark" {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children, defaultTheme = "light", switchable = true }: { children: React.ReactNode; defaultTheme?: "light" | "dark"; switchable?: boolean }) {
  const [appearance, setAppearanceState] = useState<Appearance>(() => readStored(APPEARANCE_KEY, defaultTheme));
  const [themeName, setThemeNameState] = useState<ThemeName>(() => readStored(THEME_KEY, "minimal"));
  const resolvedAppearance = appearance === "system" ? systemAppearance() : appearance;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = resolvedAppearance;
    root.dataset.theme = themeName;
    root.classList.toggle("dark", resolvedAppearance === "dark");
    root.style.colorScheme = resolvedAppearance;
    window.localStorage.setItem(APPEARANCE_KEY, appearance);
    window.localStorage.setItem(THEME_KEY, themeName);
  }, [appearance, resolvedAppearance, themeName]);

  useLayoutEffect(() => {
    if (appearance !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setAppearanceState((current) => current);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [appearance]);

  const value = useMemo<ThemeContextType>(() => ({
    theme: resolvedAppearance,
    appearance,
    resolvedAppearance,
    themeName,
    setAppearance: (next) => setAppearanceState(next),
    setThemeName: (next) => setThemeNameState(next),
    toggleTheme: () => setAppearanceState((current) => current === "dark" ? "light" : "dark"),
    switchable,
  }), [appearance, resolvedAppearance, themeName, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
