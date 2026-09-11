"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import type { Distribution } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtInt, fmtPct, fmtUsd, fmtUsdPrice } from "@/lib/format";
import { ETHERSCAN } from "@/lib/pendle/config";
import { Button } from "@/components/ui/button";

const DAY = 86_400;
/** Distributions shown at once. */
const WINDOW = 5;
/** Tallest bar as a share of the chart height; the rest is headroom for the hover card. */
const BAR_MAX = 62;

const HOVER_NONE = "(hover: none)";
const subscribeHover = (cb: () => void) => {
  const mq = matchMedia(HOVER_NONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** True on touch devices, where there is no hover: the first tap selects a bar, the second opens it. */
function useTouch() {
  return useSyncExternalStore(subscribeHover, () => matchMedia(HOVER_NONE).matches, () => false);
}

/**
 * The distribution ruler: the last five payouts as bars on a time axis, the pending buyback as a
 * dashed bar, a hover card per bar, and a strip of every distribution to move the window with.
 */
export function Ruler({
  bars,
  pending,
  pendingAt,
}: {
  bars: Distribution[];
  /** PENDLE bought back since the latest distribution, not yet paid out. */
  pending: number;
  /** Where the pending bar sits on the axis: the next due date, or now if that has passed. */
  pendingAt: number;
}) {
  const n = bars.length;
  const [end, setEnd] = useState(n);
  const start = Math.max(0, end - WINDOW);
  const view = bars.slice(start, end);
  const atLatest = end === n;

  // Touch: a tap selects the bar and shows its card; a second tap on the same bar opens Etherscan.
  // Tapping anywhere outside the chart clears the selection.
  const touch = useTouch();
  const [selected, setSelected] = useState<string | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected === null) return;
    const onDown = (e: PointerEvent) => {
      if (!chart.current?.contains(e.target as Node)) setSelected(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [selected]);
  const shift = (next: (e: number) => number) => {
    setSelected(null);
    setEnd(next);
  };

  // Bars grow in once, on first paint; moving the window afterwards is instant.
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setAnimate(false), 1400);
    return () => clearTimeout(id);
  }, []);

  const t0 = view[0].timestamp - 7 * DAY;
  const lastShown = atLatest ? Math.max(view[view.length - 1].timestamp, pendingAt) : view[view.length - 1].timestamp;
  const t1 = lastShown + 7 * DAY;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  // The main chart scales to what is in view; the strip below keeps the all-time scale.
  const peak = Math.max(...bars.map((d) => d.amount), pending);
  const viewPeak = Math.max(...view.map((d) => d.amount), atLatest ? pending : 0);
  const h = (v: number) => Math.max(2, (v / viewPeak) * BAR_MAX);

  const months: { t: number; label: string }[] = [];
  for (let d = new Date(t0 * 1000); d.getTime() / 1000 < t1; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    if (m > t0 && m < t1) months.push({ t: m, label: fmtDate(m, { day: undefined, year: undefined }) });
  }

  // Overview strip: every distribution on the full time range, with the visible window marked.
  const T0 = bars[0].timestamp - 7 * DAY;
  const T1 = pendingAt + 7 * DAY;
  const X = (t: number) => ((t - T0) / (T1 - T0)) * 100;
  const strip = useRef<HTMLDivElement>(null);
  const moveTo = (clientX: number) => {
    const el = strip.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = T0 + ((clientX - r.left) / r.width) * (T1 - T0);
    let nearest = 0;
    for (let i = 1; i < n; i++) if (Math.abs(bars[i].timestamp - t) < Math.abs(bars[nearest].timestamp - t)) nearest = i;
    shift(() => Math.min(n, Math.max(WINDOW, nearest + Math.ceil(WINDOW / 2))));
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={chart} className={cn("ruler relative h-56 sm:h-64", selected !== null && "ruler-selected")}>
        <div className="absolute inset-x-0 bottom-0 border-b border-foreground/25" />
        {view.map((d, i) => {
          const k = start + i;
          const prev = k > 0 ? bars[k - 1] : null;
          const change = prev ? d.amount / prev.amount - 1 : null;
          const px = x(d.timestamp);
          // The card sits at the top of the chart. On phones it is centred over the chart; from sm up
          // it sits beside the bar, to its right on the left half and to its left on the right half,
          // so it never leaves the figure or covers the hovered bar.
          const side = px < 55 ? "sm:left-3 sm:translate-x-0" : "sm:left-auto sm:right-3 sm:translate-x-0";
          const isSelected = selected === d.txHash;
          return (
            <Fragment key={d.txHash}>
              <a
                href={`${ETHERSCAN}/tx/${d.txHash}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Distribution ${d.epoch}, ${fmtDate(d.timestamp)}: ${fmtInt(d.amount)} sPENDLE. Opens the transaction on Etherscan.`}
                className={cn("ruler-link group absolute bottom-0 -translate-x-1/2", isSelected && "is-selected")}
                style={{ left: `${px}%`, height: `${h(d.amount)}%`, width: "clamp(10px, 4%, 28px)" }}
                onClick={(e) => {
                  if (!touch || isSelected) return;
                  e.preventDefault();
                  setSelected(d.txHash);
                }}
              >
                <span
                  className={cn(
                    "block h-full w-full rounded-t-[2px] bg-spendle transition-[background-color,opacity] duration-200 group-hover:bg-foreground",
                    isSelected && "bg-foreground",
                    animate && "ruler-bar",
                  )}
                  style={{ "--i": i } as React.CSSProperties}
                />
                <span
                  className={cn(
                    "tabular absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-spendle transition-opacity group-hover:opacity-0",
                    isSelected && "opacity-0",
                  )}
                >
                  {fmtCompact(d.amount)}
                </span>
              </a>
              <div
                aria-hidden="true"
                className={cn(
                  "ruler-tip pointer-events-none absolute top-0 left-0 z-10 w-full sm:left-(--px) sm:w-0",
                  isSelected && "is-open",
                )}
                style={{ "--px": `${px}%` } as React.CSSProperties}
              >
                <div
                  className={cn(
                    "absolute top-0 left-1/2 w-64 max-w-full -translate-x-1/2 rounded-md border border-border bg-popover p-3 text-[11px] leading-snug shadow-lg shadow-black/25 sm:max-w-none",
                    side,
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-foreground">Distribution {d.epoch}</span>
                    <span className="tabular shrink-0 text-muted-foreground">{fmtDate(d.timestamp)}</span>
                  </div>
                  <div className="font-figure mt-1 text-xl leading-none text-spendle">
                    {fmtInt(d.amount)} <span className="text-xs text-muted-foreground">sPENDLE</span>
                  </div>
                  <div className="tabular mt-1 text-muted-foreground">
                    Bought for {fmtUsd(d.usdtSpent)} at {fmtUsdPrice(d.usdtSpent / d.pendleBought)} average
                    {change !== null && (
                      <>
                        ,{" "}
                        <span className={change >= 0 ? "text-spendle" : "text-boost"}>
                          {change >= 0 ? "+" : ""}
                          {fmtPct(change, 0)}
                        </span>{" "}
                        vs the previous one
                      </>
                    )}
                  </div>
                  <dl className="tabular mt-2 flex flex-col gap-0.5 border-t border-border pt-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">Plain APR</dt>
                      <dd className="text-spendle">{fmtPct(d.aprPlain)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">Boosted, average locker</dt>
                      <dd className="text-vependle">{fmtPct(d.aprBoostedAvg)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">Split over</dt>
                      <dd className="text-right text-foreground">
                        {fmtCompact(d.eligibleSPendle)} sPENDLE + {fmtCompact(d.virtualSPendle)} virtual
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 text-muted-foreground">
                    {touch ? "Tap the bar again to open the transaction on Etherscan." : "Opens the transaction on Etherscan."}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        {atLatest && (
          <div
            title={`${fmtCompact(pending)} PENDLE bought back so far, not yet distributed`}
            className="absolute bottom-0 -translate-x-1/2"
            style={{ left: `${x(pendingAt)}%`, height: `${h(pending)}%`, width: "clamp(10px, 4%, 28px)" }}
          >
            <span
              className={cn("block h-full w-full rounded-t-[2px] border border-dashed border-spendle/70", animate && "ruler-bar")}
              style={{ "--i": view.length } as React.CSSProperties}
            />
            <span className="tabular absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground">
              {fmtCompact(pending)}
            </span>
          </div>
        )}
      </div>

      <div className="relative h-5">
        {months.map((m) => (
          <span
            key={m.t}
            className="absolute top-0 -translate-x-1/2 text-[11px] text-muted-foreground"
            style={{ left: `${x(m.t)}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Earlier distributions"
          disabled={start === 0}
          onClick={() => shift((e) => Math.max(WINDOW, e - 1))}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <div
          ref={strip}
          role="slider"
          aria-label="Visible distributions"
          aria-valuemin={WINDOW}
          aria-valuemax={n}
          aria-valuenow={end}
          aria-valuetext={`Distributions ${view[0].epoch} to ${view[view.length - 1].epoch} of ${n}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") shift((v) => Math.max(WINDOW, v - 1));
            if (e.key === "ArrowRight") shift((v) => Math.min(n, v + 1));
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            moveTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) moveTo(e.clientX);
          }}
          className="relative h-9 flex-1 cursor-ew-resize touch-none select-none rounded-sm border border-border bg-card/60"
        >
          {bars.map((d) => (
            <span
              key={d.txHash}
              className="absolute bottom-1.5 w-[3px] -translate-x-1/2 rounded-t-[1px] bg-spendle/60"
              style={{ left: `${X(d.timestamp)}%`, height: `${(d.amount / peak) * 70}%` }}
            />
          ))}
          <span
            className="absolute bottom-1.5 w-[3px] -translate-x-1/2 rounded-t-[1px] border border-dashed border-spendle/50"
            style={{ left: `${X(pendingAt)}%`, height: `${(pending / peak) * 70}%` }}
          />
          <span
            className="absolute inset-y-0 rounded-sm border border-foreground/50 bg-foreground/10 transition-[left,width] duration-200"
            style={{ left: `${X(t0)}%`, width: `${X(t1) - X(t0)}%` }}
          />
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Later distributions"
          disabled={atLatest}
          onClick={() => shift((e) => Math.min(n, e + 1))}
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <span className="tabular hidden shrink-0 text-xs text-muted-foreground sm:block">
          {view[0].epoch}–{view[view.length - 1].epoch} of {n}
        </span>
      </div>
    </div>
  );
}
