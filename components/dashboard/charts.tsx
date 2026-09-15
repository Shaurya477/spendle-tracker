"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CumPoint, FeeEpoch } from "@/lib/pendle/revenue";
import type { ProjectionPoint, UnlockWeek } from "@/lib/pendle/tracker";
import type { FlowWeek, MigrationWeek } from "@/lib/pendle/chain";
import type { Valuation } from "@/lib/pendle/valuation";
import type { MouseHandlerDataParam } from "recharts/types/synchronisation/types";
import { fmtCompact, fmtDate, fmtPct, fmtUsd, fmtUsdCompact } from "@/lib/format";
import { useSeries } from "./series";

const SPENDLE = "var(--spendle)";
const VEPENDLE = "var(--vependle)";
const BOOST = "var(--boost)";
const TREASURY = "var(--chart-4)";
const LP = "var(--chart-lp)";
const FUNDED = "var(--foreground)";
const GRID = "var(--chart-grid)";
const AXIS = "var(--chart-axis)";
const CURSOR = "var(--chart-cursor)";

const monthTick = (t: number) => {
  const d = new Date(t * 1000);
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${month} ’${String(d.getUTCFullYear()).slice(-2)}`;
};

/** `series` ties a row to a legend metric so it disappears with it; untagged rows always show. */
type TipRow = { label: string; value: string; color?: string; series?: string };

const visibleRows = (rows: TipRow[], on: (key: string) => boolean) => rows.filter((r) => !r.series || on(r.series));

function TipRows({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 text-xs">
            <span className="inline-flex items-baseline gap-1.5 text-muted-foreground">
              {r.color && <span className="inline-block size-2 shrink-0 translate-y-px rounded-sm" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="tabular shrink-0 text-right text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function TipFrame({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-popover px-3 py-2 shadow-xl">
      <TipRows title={title} rows={rows} />
    </div>
  );
}

export function DecayChart({
  points,
  sPendle,
  expiresAt,
}: {
  points: ProjectionPoint[];
  sPendle: number;
  expiresAt: number;
}) {
  const { on } = useSeries();
  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gLocked" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VEPENDLE} stopOpacity={0.55} />
            <stop offset="100%" stopColor={VEPENDLE} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="gPremium" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BOOST} stopOpacity={0.6} />
            <stop offset="100%" stopColor={BOOST} stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: CURSOR }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as ProjectionPoint;
            return (
              <TipFrame
                title={fmtDate(p.t)}
                rows={visibleRows(
                  [
                    { label: "1× base (locked PENDLE)", value: fmtCompact(p.locked), color: VEPENDLE, series: "locked" },
                    { label: "Boost premium", value: fmtCompact(p.premium), color: BOOST, series: "premium" },
                    { label: "sPENDLE today (held flat)", value: fmtCompact(sPendle), color: SPENDLE, series: "sPendle" },
                  ],
                  on,
                )}
              />
            );
          }}
        />
        <Area
          type="linear"
          dataKey="locked"
          stackId="v"
          stroke={VEPENDLE}
          strokeWidth={1.5}
          fill="url(#gLocked)"
          hide={!on("locked")}
          isAnimationActive={false}
        />
        <Area
          type="linear"
          dataKey="premium"
          stackId="v"
          stroke={BOOST}
          strokeWidth={1.5}
          fill="url(#gPremium)"
          hide={!on("premium")}
          isAnimationActive={false}
        />
        {on("sPendle") && (
          <ReferenceLine
            y={sPendle}
            stroke={SPENDLE}
            strokeDasharray="4 4"
            label={{ value: "eligible sPENDLE today", position: "insideTopLeft", fill: SPENDLE, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          />
        )}
        <ReferenceLine
          x={expiresAt}
          stroke={AXIS}
          strokeDasharray="2 4"
          label={{ value: "last snapshot unlock", position: "insideTopRight", fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PersonalAprChart({
  points,
  unlockAt,
  boostEndsAt,
}: {
  points: { t: number; apr: number }[];
  unlockAt: number | null;
  boostEndsAt: number;
}) {
  // The unlock and boost-end markers sit within days of the series' end. Carry the last point six
  // weeks further at the same APR (the projection already holds everything flat past the boost) so
  // the markers stand clear of the right edge. Their names and dates are the stat labels above.
  const PAD = 6 * 7 * 86_400;
  const last = points[points.length - 1];
  const series = last ? [...points, { t: last.t + PAD, apr: last.apr }] : points;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={series} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmtPct(v, 1)}
          domain={[0, (max: number) => Math.ceil(max * 100) / 100]}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: CURSOR }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { t: number; apr: number };
            return <TipFrame title={fmtDate(p.t)} rows={[{ label: "Your APR, buybacks only", value: fmtPct(p.apr), color: SPENDLE }]} />;
          }}
        />
        <Line type="linear" dataKey="apr" stroke={SPENDLE} strokeWidth={2} dot={false} isAnimationActive={false} />
        {unlockAt !== null && unlockAt < boostEndsAt && (
          <ReferenceLine x={unlockAt} stroke={VEPENDLE} strokeDasharray="4 4" strokeWidth={1.5} />
        )}
        <ReferenceLine x={boostEndsAt} stroke={BOOST} strokeDasharray="4 4" strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DilutionChart({ points }: { points: ProjectionPoint[] }) {
  const { on } = useSeries();
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={points} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          yAxisId="pct"
          tickFormatter={(v: number) => fmtPct(v, 0)}
          domain={[0, (max: number) => Math.ceil(max * 10) / 10]}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <YAxis
          yAxisId="apr"
          orientation="right"
          hide={!on("aprPlainFlat")}
          tickFormatter={(v: number) => fmtPct(v, 1)}
          tick={{ fill: SPENDLE, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: CURSOR }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as ProjectionPoint;
            return (
              <TipFrame
                title={fmtDate(p.t)}
                rows={visibleRows(
                  [
                    { label: "Dilution, sPENDLE flat", value: fmtPct(p.dilutionFlat, 1), color: BOOST, series: "dilutionFlat" },
                    { label: "Dilution, unlocks restaked", value: fmtPct(p.dilutionRestake, 1), color: VEPENDLE, series: "dilutionRestake" },
                    { label: "Plain APR at latest distribution", value: fmtPct(p.aprPlainFlat), color: SPENDLE, series: "aprPlainFlat" },
                  ],
                  on,
                )}
              />
            );
          }}
        />
        <Line
          yAxisId="pct"
          type="linear"
          dataKey="dilutionFlat"
          stroke={BOOST}
          strokeWidth={2}
          dot={false}
          hide={!on("dilutionFlat")}
          isAnimationActive={false}
        />
        <Line
          yAxisId="pct"
          type="linear"
          dataKey="dilutionRestake"
          stroke={VEPENDLE}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          hide={!on("dilutionRestake")}
          isAnimationActive={false}
        />
        <Line
          yAxisId="apr"
          type="linear"
          dataKey="aprPlainFlat"
          stroke={SPENDLE}
          strokeWidth={1.5}
          dot={false}
          hide={!on("aprPlainFlat")}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EpochFeeChart({ epochs }: { epochs: FeeEpoch[] }) {
  const { on } = useSeries();
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={epochs} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gYt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SPENDLE} stopOpacity={0.55} />
            <stop offset="100%" stopColor={SPENDLE} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="gSwap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VEPENDLE} stopOpacity={0.55} />
            <stop offset="100%" stopColor={VEPENDLE} stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="start"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmtUsdCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: CURSOR }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const e = payload[0].payload as FeeEpoch;
            return (
              <TipFrame
                title={`${fmtDate(e.start)}${e.complete ? "" : " (in progress)"}`}
                rows={visibleRows(
                  [
                    { label: "YT and other fees", value: fmtUsd(e.yt), color: SPENDLE, series: "yt" },
                    { label: "Swap fees", value: fmtUsd(e.swap), color: VEPENDLE, series: "swap" },
                  ],
                  on,
                )}
              />
            );
          }}
        />
        <Area
          type="linear"
          dataKey="yt"
          stackId="g"
          stroke={SPENDLE}
          strokeWidth={1.5}
          fill="url(#gYt)"
          hide={!on("yt")}
          isAnimationActive={false}
        />
        <Area
          type="linear"
          dataKey="swap"
          stackId="g"
          stroke={VEPENDLE}
          strokeWidth={1.5}
          fill="url(#gSwap)"
          hide={!on("swap")}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AccrualChart({ points }: { points: CumPoint[] }) {
  const { on } = useSeries();
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gBuyback" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SPENDLE} stopOpacity={0.5} />
            <stop offset="100%" stopColor={SPENDLE} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="gTreasury" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TREASURY} stopOpacity={0.5} />
            <stop offset="100%" stopColor={TREASURY} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="gOps" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BOOST} stopOpacity={0.5} />
            <stop offset="100%" stopColor={BOOST} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="gLp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LP} stopOpacity={0.45} />
            <stop offset="100%" stopColor={LP} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          yAxisId="usd"
          tickFormatter={(v: number) => fmtUsdCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <YAxis
          yAxisId="pendle"
          orientation="right"
          hide={!on("emittedPendle")}
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: BOOST, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: CURSOR }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as CumPoint;
            return (
              <TipFrame
                title={`Cumulative to ${fmtDate(p.t)}`}
                rows={visibleRows(
                  [
                    { label: "80% policy share", value: fmtUsd(p.buyback), color: SPENDLE, series: "buyback" },
                    { label: "Funded (USDT to buyback contract)", value: fmtUsd(p.buybackFunded), color: FUNDED, series: "buybackFunded" },
                    { label: "Treasury", value: fmtUsd(p.treasury), color: TREASURY, series: "treasury" },
                    { label: "Operations", value: fmtUsd(p.ops), color: BOOST, series: "ops" },
                    { label: "LP swap fees", value: fmtUsd(p.lp), color: LP, series: "lp" },
                    { label: "LP emissions (ETH gauge)", value: `${fmtCompact(p.emittedPendle)} PENDLE`, color: BOOST, series: "emittedPendle" },
                  ],
                  on,
                )}
              />
            );
          }}
        />
        <Area
          yAxisId="usd"
          type="linear"
          dataKey="buyback"
          stackId="cut"
          stroke={SPENDLE}
          strokeWidth={1.5}
          fill="url(#gBuyback)"
          hide={!on("buyback")}
          isAnimationActive={false}
        />
        <Area
          yAxisId="usd"
          type="linear"
          dataKey="treasury"
          stackId="cut"
          stroke={TREASURY}
          strokeWidth={1.5}
          fill="url(#gTreasury)"
          hide={!on("treasury")}
          isAnimationActive={false}
        />
        <Area
          yAxisId="usd"
          type="linear"
          dataKey="ops"
          stackId="cut"
          stroke={BOOST}
          strokeWidth={1.5}
          fill="url(#gOps)"
          hide={!on("ops")}
          isAnimationActive={false}
        />
        <Area
          yAxisId="usd"
          type="linear"
          dataKey="lp"
          stackId="cut"
          stroke={LP}
          strokeWidth={1.5}
          fill="url(#gLp)"
          hide={!on("lp")}
          isAnimationActive={false}
        />
        <Line
          yAxisId="usd"
          type="linear"
          dataKey="buybackFunded"
          stroke={FUNDED}
          strokeWidth={1.5}
          dot={false}
          hide={!on("buybackFunded")}
          isAnimationActive={false}
        />
        <Line
          yAxisId="pendle"
          type="linear"
          dataKey="emittedPendle"
          stroke={BOOST}
          strokeWidth={1.75}
          strokeDasharray="5 4"
          dot={false}
          hide={!on("emittedPendle")}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * vePENDLE → sPENDLE by week. Bars (left axis): PENDLE withdrawn from expired locks, split into what
 * the same wallet staked into sPENDLE within 30 days and what it did not. Lines (right axis): PENDLE
 * still in the vePENDLE contract and sPENDLE supply at the end of each week.
 */
export function MigrationChart({ weeks }: { weeks: MigrationWeek[] }) {
  const { on } = useSeries();
  const data = weeks.map((w) => ({
    t: w.start,
    restaked: w.restaked,
    notRestaked: w.withdrawn - w.restaked,
    withdrawn: w.withdrawn,
    open: w.open,
    vePendle: w.vePendle,
    sPendle: w.sPendle,
  }));
  const week = 7 * 86_400;
  // Phones: the in-chart tooltip does not fit, so the active week is shown in a panel under the chart.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const pick = (s: MouseHandlerDataParam) => {
    // Recharts 3 reports the index as a string for category-indexed charts.
    const i = s.activeTooltipIndex === undefined ? NaN : Number(s.activeTooltipIndex);
    if (Number.isInteger(i) && i >= 0 && i < data.length) setActiveIdx(i);
  };
  const rowsFor = (p: (typeof data)[number]): TipRow[] => {
    const share = p.withdrawn > 0 ? fmtPct(p.restaked / p.withdrawn, 0) : "–";
    return visibleRows(
      [
        { label: "Restaked as sPENDLE within 30 d", value: `${fmtCompact(p.restaked)} PENDLE (${share})`, color: SPENDLE, series: "restaked" },
        { label: "Not restaked", value: fmtCompact(p.notRestaked), color: VEPENDLE, series: "notRestaked" },
        { label: "PENDLE in vePENDLE, week end", value: fmtCompact(p.vePendle), color: VEPENDLE, series: "vePendle" },
        { label: "sPENDLE supply, week end", value: fmtCompact(p.sPendle), color: SPENDLE, series: "sPendle" },
      ],
      on,
    );
  };
  const titleFor = (p: (typeof data)[number]) =>
    `Week of ${fmtDate(p.t)}${p.open ? " (30-day window still open)" : ""}`;
  const shown = data[activeIdx ?? data.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          onMouseMove={pick}
          onTouchStart={pick}
          onTouchMove={pick}
          onMouseLeave={() => setActiveIdx(null)}
        >
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[(min: number) => min - week / 2, (max: number) => max + week / 2]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          yAxisId="flow"
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <YAxis
          yAxisId="stock"
          orientation="right"
          hide={!on("vePendle") && !on("sPendle")}
          domain={[0, (max: number) => Math.ceil(max / 10e6) * 10e6]}
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: CURSOR, fillOpacity: 0.12 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof data)[number];
            return (
              <div className="hidden sm:block">
                <TipFrame title={titleFor(p)} rows={rowsFor(p)} />
              </div>
            );
          }}
        />
        <Bar yAxisId="flow" dataKey="restaked" stackId="w" fill={SPENDLE} hide={!on("restaked")} isAnimationActive={false} />
        <Bar yAxisId="flow" dataKey="notRestaked" stackId="w" fill={VEPENDLE} fillOpacity={0.55} radius={[2, 2, 0, 0]} hide={!on("notRestaked")} isAnimationActive={false} />
        <Line yAxisId="stock" type="linear" dataKey="vePendle" stroke={VEPENDLE} strokeWidth={1.5} dot={false} hide={!on("vePendle")} isAnimationActive={false} />
        <Line yAxisId="stock" type="linear" dataKey="sPendle" stroke={SPENDLE} strokeWidth={1.5} dot={false} hide={!on("sPendle")} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="rounded-md border border-border bg-background/40 px-3 py-2 sm:hidden">
        <TipRows title={titleFor(shown)} rows={rowsFor(shown)} />
        {activeIdx === null && (
          <div className="mt-1.5 text-[11px] text-muted-foreground">Latest week. Touch the chart to see another.</div>
        )}
      </div>
    </div>
  );
}

/** Weekly holder stakes up, unstakes down (cooldown and instant), with the cooldown queue on the right axis. */
export function FlowsChart({ weeks }: { weeks: FlowWeek[] }) {
  const { on } = useSeries();
  const data = weeks.map((w) => ({
    t: w.start,
    staked: w.staked,
    cooldown: -w.toCooldown,
    instant: -w.instant,
    cancelled: w.cancelled,
    net: w.staked + w.cancelled - w.toCooldown - w.instant,
    queue: w.queueEnd,
    fee: w.instantFee,
  }));
  const week = 7 * 86_400;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const pick = (s: MouseHandlerDataParam) => {
    const i = s.activeTooltipIndex === undefined ? NaN : Number(s.activeTooltipIndex);
    if (Number.isInteger(i) && i >= 0 && i < data.length) setActiveIdx(i);
  };
  const rowsFor = (p: (typeof data)[number]): TipRow[] =>
    visibleRows(
      [
        { label: "Net holder flow", value: `${p.net >= 0 ? "+" : "−"}${fmtCompact(Math.abs(p.net))} PENDLE`, color: TREASURY, series: "net" },
        { label: "Staked by holders", value: fmtCompact(p.staked), color: SPENDLE, series: "staked" },
        { label: "Sent to cooldown", value: fmtCompact(-p.cooldown), color: VEPENDLE, series: "cooldown" },
        { label: "Unstaked instantly (fee paid)", value: `${fmtCompact(-p.instant)} (${fmtCompact(p.fee)})`, color: BOOST, series: "instant" },
        { label: "Cooldown queue, week end", value: fmtCompact(p.queue), color: FUNDED, series: "queue" },
      ],
      on,
    );
  const titleFor = (p: (typeof data)[number]) => `Week of ${fmtDate(p.t)}`;
  const shown = data[activeIdx ?? data.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={data}
          stackOffset="sign"
          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          onMouseMove={pick}
          onTouchStart={pick}
          onTouchMove={pick}
          onMouseLeave={() => setActiveIdx(null)}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[(min: number) => min - week / 2, (max: number) => max + week / 2]}
            tickFormatter={monthTick}
            tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            yAxisId="flow"
            tickFormatter={(v: number) => fmtCompact(v)}
            tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="queue"
            orientation="right"
            hide={!on("queue")}
            domain={[0, (max: number) => Math.ceil(max / 5e5) * 5e5]}
            tickFormatter={(v: number) => fmtCompact(v)}
            tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <ReferenceLine yAxisId="flow" y={0} stroke={AXIS} />
          <Tooltip
            cursor={{ fill: CURSOR, fillOpacity: 0.12 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <div className="hidden sm:block">
                  <TipFrame title={titleFor(p)} rows={rowsFor(p)} />
                </div>
              );
            }}
          />
          <Bar yAxisId="flow" dataKey="staked" stackId="f" fill={SPENDLE} radius={[2, 2, 0, 0]} hide={!on("staked")} isAnimationActive={false} />
          <Bar yAxisId="flow" dataKey="cooldown" stackId="f" fill={VEPENDLE} fillOpacity={0.7} hide={!on("cooldown")} isAnimationActive={false} />
          <Bar yAxisId="flow" dataKey="instant" stackId="f" fill={BOOST} radius={[0, 0, 2, 2]} hide={!on("instant")} isAnimationActive={false} />
          <Line yAxisId="flow" type="linear" dataKey="net" stroke={TREASURY} strokeWidth={2} dot={false} hide={!on("net")} isAnimationActive={false} />
          <Line yAxisId="queue" type="linear" dataKey="queue" stroke={FUNDED} strokeWidth={1.5} dot={false} hide={!on("queue")} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="rounded-md border border-border bg-background/40 px-3 py-2 sm:hidden">
        <TipRows title={titleFor(shown)} rows={rowsFor(shown)} />
        {activeIdx === null && (
          <div className="mt-1.5 text-[11px] text-muted-foreground">Latest week. Touch the chart to see another.</div>
        )}
      </div>
    </div>
  );
}

/** PENDLE still locked over time under the snapshot schedule and the live one, as step lines. */
export function UnlockCalendarChart({ snapshot, live, now }: { snapshot: UnlockWeek[]; live: UnlockWeek[]; now: number }) {
  const { on } = useSeries();
  const total = (u: UnlockWeek[]) => u.reduce((s, w) => s + w.amount, 0);
  const points = new Map<number, { t: number; snapshot?: number; live?: number }>();
  const put = (t: number, key: "snapshot" | "live", v: number) => {
    const p = points.get(t) ?? { t };
    p[key] = v;
    points.set(t, p);
  };
  put(now, "snapshot", total(snapshot));
  put(now, "live", total(live));
  for (const w of snapshot) put(w.expiry, "snapshot", w.cumulativeRemaining);
  for (const w of live) put(w.expiry, "live", w.cumulativeRemaining);
  const data = [...points.values()].sort((a, b) => a.t - b.t);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={monthTick}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          domain={[0, (max: number) => Math.ceil(max / 10e6) * 10e6]}
          // The scale can hand back −0 for the bottom tick, which Intl prints as "-0".
          tickFormatter={(v: number) => fmtCompact(v === 0 ? 0 : v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: CURSOR }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as (typeof data)[number];
            return (
              <TipFrame
                title={`After ${fmtDate(p.t)}`}
                rows={visibleRows(
                  [
                    { label: "Still locked, live schedule", value: p.live === undefined ? "–" : fmtCompact(p.live), color: VEPENDLE, series: "live" },
                    { label: "Still locked, snapshot schedule", value: p.snapshot === undefined ? "–" : fmtCompact(p.snapshot), color: BOOST, series: "snapshot" },
                  ],
                  on,
                )}
              />
            );
          }}
        />
        <Line type="stepAfter" dataKey="snapshot" stroke={BOOST} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls hide={!on("snapshot")} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="live" stroke={VEPENDLE} strokeWidth={1.5} dot={false} connectNulls hide={!on("live")} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * What each distribution's buyback paid per PENDLE (line, always shown), the USDT it spent and the
 * PENDLE it bought as paired bars on their own axes, and PENDLE's daily market price. A strip under
 * the chart shows paid ÷ market on the buying days − 1 per distribution. The market series carries
 * its own daily data and is removed entirely when hidden, so hovering then only lands on
 * distributions. Both panels share one tooltip through `syncId`.
 */
export function BuybackPriceChart({ prices, history }: { prices: Valuation["buybackPrices"]; history: Valuation["priceHistory"] }) {
  const { on } = useSeries();
  type Print = Valuation["buybackPrices"][number] & { t: number };
  const prints: Print[] = prices.map((p) => ({ ...p, t: p.timestamp }));
  const market = on("market") ? history.map((h) => ({ t: h.t, market: h.price })) : [];
  const top = Math.max(...(on("market") ? history.map((h) => h.price) : []), ...prices.map((p) => p.price));
  const epoch = 14 * 86_400;
  const t0 = Math.min(history[0].t, prices[0].timestamp) - epoch / 2;
  const t1 = Math.max(history[history.length - 1].t, prices[prices.length - 1].timestamp) + epoch / 2;
  const signed = (x: number) => `${x >= 0 ? "+" : "−"}${fmtPct(Math.abs(x), 2)}`;
  const slipMax = Math.ceil(Math.max(...prices.map((p) => Math.abs(p.slippage))) * 100) / 100;
  // Paired bars: fixed 10 px columns either side of the band centre, so the daily market points on
  // the axis cannot shrink them to hairlines.
  type Box = { x?: number; y?: number; width?: number; height?: number };
  const column = ({ x = 0, y = 0, width = 0, height = 0 }: Box, offset: number, fill: string) => (
    <rect x={x + width / 2 + offset} y={y} width={10} height={Math.max(0, height)} rx={2} fill={fill} fillOpacity={0.65} />
  );
  const both = on("usd") && on("pendle");
  const xAxis = (hide: boolean) => (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={[t0, t1]}
      allowDataOverflow
      hide={hide}
      tickFormatter={monthTick}
      tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" }}
      axisLine={{ stroke: GRID }}
      tickLine={false}
      minTickGap={48}
    />
  );
  const tickStyle = { fill: AXIS, fontSize: 11, fontFamily: "var(--font-bricolage)" };
  return (
    <div className="flex flex-col">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={prints} syncId="buyback" syncMethod="value" margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          {xAxis(false)}
          <YAxis yAxisId="usd" hide={!on("usd")} tickFormatter={(v: number) => fmtUsdCompact(v)} tick={tickStyle} axisLine={false} tickLine={false} width={52} />
          <YAxis yAxisId="pendle" hide={!on("pendle")} tickFormatter={(v: number) => fmtCompact(v)} tick={{ ...tickStyle, fill: VEPENDLE }} axisLine={false} tickLine={false} width={48} />
          <YAxis
            yAxisId="price"
            orientation="right"
            hide={!on("paid") && !on("market")}
            domain={[0, Math.ceil(top * 2) / 2]}
            tickFormatter={(v: number) => `$${v.toFixed(1)}`}
            tick={tickStyle}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: CURSOR }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              // The payload lists every series with a point at this x, in render order; the market
              // series comes first, so pick the distribution entry explicitly when there is one.
              type Entry = Partial<Print> & { market?: number };
              const entries = payload.map((e) => e.payload as Entry);
              const p = entries.find((e) => e.price !== undefined) ?? entries[0];
              if (p.price === undefined) {
                // A day with no distribution: only the market series has a point here.
                if (p.market === undefined) return null;
                return <TipFrame title={fmtDate(p.t!)} rows={[{ label: "PENDLE market price", value: `$${p.market.toFixed(3)}`, color: BOOST }]} />;
              }
              return (
                <TipFrame
                  title={`Distribution ${p.epoch}, ${fmtDate(p.timestamp!)}`}
                  rows={visibleRows(
                    [
                      { label: "Paid per PENDLE", value: `$${p.price.toFixed(3)}`, color: FUNDED, series: "paid" },
                      { label: "USDT spent", value: fmtUsd(p.usd!), color: SPENDLE, series: "usd" },
                      { label: "PENDLE bought", value: fmtCompact(p.pendle!), color: VEPENDLE, series: "pendle" },
                      {
                        label: `Market while buying, ${fmtDate(p.from!, { year: undefined })} to ${fmtDate(p.to!, { year: undefined })}`,
                        value: `$${p.benchmark!.toFixed(3)}`,
                        color: BOOST,
                        series: "market",
                      },
                      { label: "Paid vs market", value: signed(p.slippage!), color: TREASURY, series: "slippage" },
                    ],
                    on,
                  )}
                />
              );
            }}
          />
          <Bar yAxisId="usd" dataKey="usd" hide={!on("usd")} isAnimationActive={false} shape={(b: Box) => column(b, both ? -11 : -5, SPENDLE)} />
          <Bar yAxisId="pendle" dataKey="pendle" hide={!on("pendle")} isAnimationActive={false} shape={(b: Box) => column(b, both ? 1 : -5, VEPENDLE)} />
          <Line yAxisId="price" data={market} type="monotone" dataKey="market" stroke={BOOST} strokeWidth={1.25} dot={false} isAnimationActive={false} />
          <Line yAxisId="price" type="linear" dataKey="price" stroke={FUNDED} strokeWidth={1.5} dot={{ r: 2.5, fill: FUNDED, strokeWidth: 0 }} hide={!on("paid")} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      {on("slippage") && (
        <ResponsiveContainer width="100%" height={84}>
          {/* Left margin equals the width of the axes shown above, so the two panels line up; the
              time axis is the one above. */}
          <ComposedChart
            data={prints}
            syncId="buyback"
            syncMethod="value"
            margin={{ top: 8, right: 8, left: (on("usd") ? 52 : 0) + (on("pendle") ? 48 : 0), bottom: 8 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            {xAxis(true)}
            <YAxis
              yAxisId="slip"
              orientation="right"
              domain={[-slipMax, slipMax]}
              ticks={[-slipMax, 0, slipMax]}
              interval={0}
              tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`}
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine yAxisId="slip" y={0} stroke={AXIS} />
            <Tooltip cursor={{ stroke: CURSOR }} content={() => null} />
            <Bar yAxisId="slip" dataKey="slippage" isAnimationActive={false} shape={(b: Box) => column(b, -5, TREASURY)} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
