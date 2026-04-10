"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "var(--cc-surface-2)",
        border: "1px solid var(--cc-border)",
        color: "var(--cc-text-secondary)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--cc-accent)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cc-accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--cc-text-secondary)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cc-border)";
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
