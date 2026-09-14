"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "cn";
import type { SeriesDef } from "@/lib/chart-series";

type SeriesState = {
  defs: SeriesDef[];
  hidden: ReadonlySet<string>;
  toggle: (key: string) => void;
};

const SeriesContext = createContext<SeriesState | null>(null);

/**
 * Holds which of a chart's metrics are shown. Wrap the card content so the legend (wherever it
 * sits in the header) and the chart below it share the state. A locked metric ignores toggles.
 */
export function SeriesProvider({ series, children }: { series: SeriesDef[]; children: ReactNode }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const value = useMemo<SeriesState>(
    () => ({
      defs: series,
      hidden,
      toggle: (key) => {
        if (series.find((s) => s.key === key)?.locked) return;
        setHidden((h) => {
          const next = new Set(h);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      },
    }),
    [series, hidden],
  );
  return <SeriesContext.Provider value={value}>{children}</SeriesContext.Provider>;
}

/** `on(key)`: whether a metric is currently drawn. Charts call this for each series and tooltip row. */
export function useSeries() {
  const ctx = useContext(SeriesContext);
  if (!ctx) throw new Error("useSeries must be used inside a SeriesProvider");
  const on = (key: string) => !ctx.hidden.has(key);
  return { on, defs: ctx.defs };
}

function Swatch({ def, off }: { def: SeriesDef; off: boolean }) {
  const color = off ? "var(--muted-foreground)" : def.color;
  if (def.shape === "bar" || def.shape === "area") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block size-2 rounded-sm", off && "opacity-50")}
        style={off ? { border: `1px solid ${color}` } : { background: color }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block w-3.5 border-t-2", def.shape === "dashed" && "border-dashed", off && "opacity-50")}
      style={{ borderColor: color }}
    />
  );
}

/**
 * The chart's legend as filter chips. A toggleable metric is a bordered button with a check while
 * shown and a dashed outline while hidden; the locked metric is a flat chip with a lock and no
 * hover, so the two read differently at a glance.
 */
export function SeriesLegend({ className }: { className?: string }) {
  const ctx = useContext(SeriesContext);
  if (!ctx) throw new Error("SeriesLegend must be used inside a SeriesProvider");
  return (
    <div className={cn("flex flex-wrap gap-1.5 text-[11px]", className)} role="group" aria-label="Metrics shown; click to hide or show">
      {ctx.defs.map((def) => {
        const off = ctx.hidden.has(def.key);
        if (def.locked) {
          return (
            <span
              key={def.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-muted/40 px-2 py-0.5 text-muted-foreground"
              title="Always shown"
            >
              <Swatch def={def} off={false} />
              {def.label}
              <Lock className="size-2.5 opacity-70" aria-hidden="true" />
              <span className="sr-only">, always shown</span>
            </span>
          );
        }
        return (
          <button
            key={def.key}
            type="button"
            aria-pressed={!off}
            title={off ? "Click to show" : "Click to hide"}
            onClick={() => ctx.toggle(def.key)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              off
                ? "border-dashed border-border text-muted-foreground/60 hover:border-foreground/40 hover:text-muted-foreground"
                : "border-border bg-card text-foreground hover:border-foreground/40",
            )}
          >
            <Swatch def={def} off={off} />
            {def.label}
            <Check className={cn("size-3 transition-opacity", off ? "opacity-0" : "opacity-70")} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
