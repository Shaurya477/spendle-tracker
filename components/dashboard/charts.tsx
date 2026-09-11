"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectionPoint } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtMult, fmtPct } from "@/lib/format";

const SPENDLE = "var(--spendle)";
const VEPENDLE = "var(--vependle)";
const BOOST = "var(--boost)";
const GRID = "oklch(1 0 0 / 6%)";
const AXIS = "oklch(0.68 0.015 80)";

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
          cursor={{ stroke: "oklch(1 0 0 / 25%)" }}
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
          cursor={{ stroke: "oklch(1 0 0 / 25%)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as ProjectionPoint;
            return (
              <TipFrame
                title={fmtDate(p.t)}
                rows={[
                  { label: "Dilution · sPENDLE flat", value: fmtPct(p.dilutionFlat, 1), color: BOOST },
                  { label: "Dilution · unlocks restaked", value: fmtPct(p.dilutionRestake, 1), color: VEPENDLE },
                  { label: "Plain APR at latest epoch's payout", value: fmtPct(p.aprPlainFlat), color: SPENDLE },
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
