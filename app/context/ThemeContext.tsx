"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

/**
 * Shared by both root layouts, which have OPPOSITE defaults: the web tree is
 * dark-first (Midnight Kitchen) and the mobile tree is light-first (meshi
 * Kitchef). The default therefore has to come from the caller — a hardcoded
 * "dark" fallback here silently overrode mobile's light default and rendered
 * the whole re-skin in the dark token pass.
 *
 * `crave_theme` is also shared across both trees, which is intentional: it is
 * the user's explicit preference, and someone who has chosen dark should get
 * dark on both surfaces. Only the DEFAULT differs.
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  // Prefer whatever the anti-flash inline script already resolved, so we don't
  // fight it and cause a flash.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const fromDom = document.documentElement.getAttribute("data-theme") as Theme | null;
    return fromDom ?? defaultTheme;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("crave_theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
