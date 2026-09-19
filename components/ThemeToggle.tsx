"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`border border-[var(--m-ink-faint)] text-[var(--m-ink-soft)] hover:border-[var(--m-forest)] hover:text-[var(--m-forest)] ${className ?? ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "var(--m-cream-2)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        flexShrink: 0,
      }}
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
