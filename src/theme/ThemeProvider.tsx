import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readStorage, writeStorage } from "@/lib/storage";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "mondo-theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  // Keep in step with the pre-paint script in index.html, which applies the
  // stored theme before React loads so a light-mode visitor never sees a
  // flash of the dark theme.
  const stored = readStorage(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Dark is the brand, so it is the default for every first-time visitor —
  // deliberately NOT following prefers-color-scheme, which used to hand a
  // light-mode phone the light theme before the visitor had seen the store as
  // it is meant to look. Only an explicit toggle switches it, and that choice
  // is what persists.
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0a0a0b" : "#f0e3c6");
    writeStorage(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
