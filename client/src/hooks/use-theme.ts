import { useState, useEffect, useCallback } from "react";

// Theme types
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";

// Get system preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Resolve theme mode to actual theme
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

// Get initial theme from localStorage
function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

// Apply theme to document
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.setAttribute("data-theme", resolved);
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      resolved === "dark" ? "#1a1612" : "#f5f2ef"
    );
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => 
    resolveTheme(getStoredTheme())
  );

  // Apply theme when mode changes
  useEffect(() => {
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [mode]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [mode]);

  // Listen for cross-tab storage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const newMode = e.newValue as ThemeMode;
        if (newMode === "light" || newMode === "dark" || newMode === "system") {
          setModeState(newMode);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Set theme mode and persist
  const setTheme = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  // Toggle between light and dark (for quick toggle)
  const toggleTheme = useCallback(() => {
    const nextResolved = resolvedTheme === "light" ? "dark" : "light";
    setTheme(nextResolved);
  }, [resolvedTheme, setTheme]);

  return {
    mode,
    theme: resolvedTheme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
  };
}
