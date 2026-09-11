"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

export type NavSection = { id: string; index: string; title: string };

/** The section whose top has passed a line ~30% down the viewport; the first one before any has. */
function useActiveSection(sections: NavSection[]) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;
    const pick = () => {
      const line = window.innerHeight * 0.3;
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", pick);
    window.addEventListener("resize", pick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", pick);
      window.removeEventListener("resize", pick);
    };
  }, [sections]);
  return active;
}

/** Vertical section list for the desktop rail. */
export function SectionList({ sections }: { sections: NavSection[] }) {
  const active = useActiveSection(sections);
  return (
    <nav aria-label="Sections" className="flex flex-col">
      {sections.map((s) => {
        const on = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={on ? "location" : undefined}
            className={cn(
              "group flex items-baseline gap-3 border-l py-1.5 pl-4 text-sm transition-colors",
              on
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            <span className={cn("tabular text-xs", on ? "text-foreground" : "text-muted-foreground/70")}>{s.index}</span>
            {s.title}
          </a>
        );
      })}
    </nav>
  );
}

/** Sticky horizontal pills for phones and tablets; scrolls sideways and keeps the active one in view. */
export function SectionBar({ sections }: { sections: NavSection[] }) {
  const active = useActiveSection(sections);

  useEffect(() => {
    const pill = document.querySelector<HTMLElement>(`[data-nav-id="${active}"]`);
    const rail = pill?.parentElement;
    if (!pill || !rail || rail.scrollWidth <= rail.clientWidth) return;
    const offset = pill.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    rail.scrollTo({ left: offset - (rail.clientWidth - pill.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label="Sections" className="sticky top-3 z-30 -mx-4 px-4 sm:-mx-8 sm:px-8 lg:hidden">
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-border bg-background/85 p-1 backdrop-blur">
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-nav-id={s.id}
              aria-current={on ? "location" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className={cn("tabular", on ? "text-background/70" : "text-muted-foreground/70")}>{s.index}</span>
              {s.title}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
