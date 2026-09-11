"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_KEY } from "@/lib/theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isDark = () => document.documentElement.classList.contains("dark");

function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  for (const listener of listeners) listener();
}

/**
 * Current theme and a setter. The server snapshot is dark (the default); the client snapshot reads
 * the class the bootstrap script left on <html>, so a stored light preference hydrates cleanly.
 */
export function useDarkTheme() {
  const dark = useSyncExternalStore(subscribe, isDark, () => true);
  return [dark, setDark] as const;
}

export function ThemeToggle() {
  const [dark, setDark] = useDarkTheme();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={!dark}
      onClick={() => setDark(!dark)}
    >
      {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
    </Button>
  );
}
