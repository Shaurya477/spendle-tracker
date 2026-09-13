"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * A horizontal, snap-scrolling row of cards with an arrow on each side and one dot per card.
 * One card is visible on phones, two on tablets, three on wide screens; swipe, arrows, and the
 * dots all move it.
 */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const items = Children.toArray(children);
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(1);

  useEffect(() => {
    const el = track.current!;
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
      setIndex(Math.round(el.scrollLeft / step));
      setPerView(Math.max(1, Math.round(el.clientWidth / step)));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, []);

  const last = Math.max(0, items.length - perView);
  const go = (i: number) => {
    const el = track.current!;
    const first = el.firstElementChild as HTMLElement;
    const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
    el.scrollTo({ left: Math.min(last, Math.max(0, i)) * step, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
        <Button variant="outline" size="icon-sm" aria-label={`Previous ${label}`} disabled={index <= 0} onClick={() => go(index - 1)}>
          <ChevronLeft className="size-3.5" />
        </Button>
        <ul
          ref={track}
          aria-label={label}
          className="no-scrollbar flex min-w-0 snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth"
        >
          {items.map((item, i) => (
            <li key={i} className="flex w-full shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]">
              {item}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="icon-sm" aria-label={`Next ${label}`} disabled={index >= last} onClick={() => go(index + 1)}>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
      <div className="flex justify-center gap-1.5" role="tablist" aria-label={`${label} position`}>
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i >= index && i < index + perView}
            aria-label={`${label} ${i + 1} of ${items.length}`}
            onClick={() => go(i)}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              i >= index && i < index + perView ? "bg-foreground/70" : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}
