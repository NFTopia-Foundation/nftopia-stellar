"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/stores/preferences-store";

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme({ mode: theme.mode === "dark" ? "light" : "dark" });
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-card border border-border text-card-foreground hover:bg-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      aria-label={`Switch to ${theme.mode === "dark" ? "light" : "dark"} mode`}
      title={`Current: ${theme.mode} mode - Click to switch to ${theme.mode === "dark" ? "light" : "dark"} mode`}
    >
      {theme.mode === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
};
