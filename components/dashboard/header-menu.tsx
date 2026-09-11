"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Moon, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitHubMark } from "./github-mark";
import { useDarkTheme } from "./theme-toggle";
import { useRefreshTracker } from "./refresh-button";

const BAR = "absolute left-0 top-1/2 h-[1.5px] w-full rounded-full bg-current transition-[transform,opacity] duration-200 ease-out";
const ITEM =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-foreground hover:bg-muted disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0";

/** Phone-width replacement for the three header buttons: one knob that opens a right-aligned menu. */
export function HeaderMenu({ repoUrl }: { repoUrl: string }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useDarkTheme();
  const [pending, refresh] = useRefreshTracker();
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className="relative block size-3.5">
          <span
            className={BAR}
            style={{ transform: open ? "translateY(-50%) rotate(45deg)" : "translateY(calc(-50% - 5px))" }}
          />
          <span
            className={BAR}
            style={{ transform: open ? "translateY(-50%) scaleX(0)" : "translateY(-50%)", opacity: open ? 0 : 1 }}
          />
          <span
            className={BAR}
            style={{ transform: open ? "translateY(-50%) rotate(-45deg)" : "translateY(calc(-50% + 5px))" }}
          />
        </span>
      </Button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
        >
          <button type="button" role="menuitem" className={ITEM} onClick={() => setDark(!dark)}>
            {dark ? <Sun /> : <Moon />}
            {dark ? "Light mode" : "Dark mode"}
          </button>
          <a role="menuitem" href={repoUrl} target="_blank" rel="noreferrer" className={ITEM}>
            <GitHubMark />
            Source on GitHub
          </a>
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            disabled={pending}
            onClick={() => {
              refresh();
              setOpen(false);
            }}
          >
            <RefreshCw className={pending ? "animate-spin" : ""} />
            {pending ? "Reading chain…" : "Refresh data"}
          </button>
        </div>
      )}
    </div>
  );
}
