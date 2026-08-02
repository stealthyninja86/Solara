import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export type ThemeChoice = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "solara-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  return choice === "system" ? getSystemTheme() : choice;
}

function readStoredTheme(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

function applyResolvedTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => resolveTheme(readStoredTheme()));

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyResolvedTheme(resolved);
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeChoice) => {
    setThemeState(newTheme);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeContext must be used within ThemeProvider");
  return context;
}
