"use client";

import {
  Area,
  AreaChart,
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
import type { ProjectionPoint } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtMult, fmtPct, fmtUsd, fmtUsdCompact } from "@/lib/format";

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

function TipFrame({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {r.color && <span className="inline-block size-2 rounded-sm" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="tabular font-mono text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
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
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
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
                rows={[
                  { label: "Virtual sPENDLE", value: fmtCompact(p.virtual), color: BOOST },
                  { label: "of which 1× base (locked PENDLE)", value: fmtCompact(p.locked), color: VEPENDLE },
                  { label: "of which boost premium", value: fmtCompact(p.premium) },
                  { label: "Average multiplier", value: fmtMult(p.avgMultiplier) },
                  { label: "sPENDLE (held flat)", value: fmtCompact(sPendle), color: SPENDLE },
                ]}
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
          isAnimationActive={false}
        />
        <Area
          type="linear"
          dataKey="premium"
          stackId="v"
          stroke={BOOST}
          strokeWidth={1.5}
          fill="url(#gPremium)"
          isAnimationActive={false}
        />
        <ReferenceLine
          y={sPendle}
          stroke={SPENDLE}
          strokeDasharray="4 4"
          label={{ value: "eligible sPENDLE today", position: "insideTopLeft", fill: SPENDLE, fontSize: 11, fontFamily: "var(--font-mono)" }}
        />
        <ReferenceLine
          x={expiresAt}
          stroke={AXIS}
          strokeDasharray="2 4"
          label={{ value: "last snapshot unlock", position: "insideTopRight", fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
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
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmtPct(v, 1)}
          domain={[0, (max: number) => Math.ceil(max * 100) / 100]}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
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
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          yAxisId="pct"
          tickFormatter={(v: number) => fmtPct(v, 0)}
          domain={[0, (max: number) => Math.ceil(max * 10) / 10]}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <YAxis
          yAxisId="apr"
          orientation="right"
          tickFormatter={(v: number) => fmtPct(v, 1)}
          tick={{ fill: SPENDLE, fontSize: 11, fontFamily: "var(--font-mono)" }}
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
                rows={[
                  { label: "Dilution, sPENDLE flat", value: fmtPct(p.dilutionFlat, 1), color: BOOST },
                  { label: "Dilution, unlocks restaked", value: fmtPct(p.dilutionRestake, 1), color: VEPENDLE },
                  { label: "Plain APR at latest distribution", value: fmtPct(p.aprPlainFlat), color: SPENDLE },
                  { label: "Stakers' reward share (flat)", value: fmtPct(p.stakerShareFlat, 1) },
                  { label: "Average multiplier", value: fmtMult(p.avgMultiplier) },
                ]}
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
          isAnimationActive={false}
        />
        <Line
          yAxisId="apr"
          type="linear"
          dataKey="aprPlainFlat"
          stroke={SPENDLE}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EpochFeeChart({ epochs }: { epochs: FeeEpoch[] }) {
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
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmtUsdCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
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
                rows={[
                  { label: "YT and other fees", value: fmtUsd(e.yt), color: SPENDLE },
                  { label: "Swap fees", value: fmtUsd(e.swap), color: VEPENDLE },
                  { label: "Gross (non-swap + swap)", value: fmtUsd(e.yt + e.swap) },
                  { label: "Protocol take (DefiLlama Revenue)", value: fmtUsd(e.revenue) },
                  { label: "LP 20% of swap", value: fmtUsd(e.lp), color: LP },
                ]}
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
          isAnimationActive={false}
        />
        <Area
          type="linear"
          dataKey="swap"
          stackId="g"
          stroke={VEPENDLE}
          strokeWidth={1.5}
          fill="url(#gSwap)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AccrualChart({ points }: { points: CumPoint[] }) {
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
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          yAxisId="usd"
          tickFormatter={(v: number) => fmtUsdCompact(v)}
          tick={{ fill: AXIS, fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <YAxis
          yAxisId="pendle"
          orientation="right"
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: BOOST, fontSize: 11, fontFamily: "var(--font-mono)" }}
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
                rows={[
                  { label: "80% policy share", value: fmtUsd(p.buyback), color: SPENDLE },
                  { label: "Funded (USDT to buyback contract)", value: fmtUsd(p.buybackFunded), color: FUNDED },
                  { label: "Treasury", value: fmtUsd(p.treasury), color: TREASURY },
                  { label: "Operations", value: fmtUsd(p.ops), color: BOOST },
                  { label: "LP swap fees", value: fmtUsd(p.lp), color: LP },
                  { label: "LP emissions (ETH gauge)", value: `${fmtCompact(p.emittedPendle)} PENDLE` },
                ]}
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
          isAnimationActive={false}
        />
        <Line
          yAxisId="usd"
          type="linear"
          dataKey="buybackFunded"
          stroke={FUNDED}
          strokeWidth={1.5}
          dot={false}
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
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
