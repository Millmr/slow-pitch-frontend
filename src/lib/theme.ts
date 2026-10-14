import { useEffect, useState } from "react";

// Dark (Slate) is the default; people can switch to light and it's
// remembered on their device. index.html applies the choice before first
// paint; this keeps it in sync after.

export type Theme = "light" | "dark";

const KEY = "slowpitch.theme";
const BAR_COLORS: Record<Theme, string> = { light: "#2a3037", dark: "#11161c" };

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLORS[theme]);
    try {
      if (theme === "dark") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  }, [theme]);

  return [theme, setTheme];
}
