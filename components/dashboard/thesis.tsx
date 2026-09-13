import { Check, X } from "lucide-react";
import { cn } from "cn";
import type { TrackerData } from "@/lib/pendle/tracker";
import { buildThesis, type Metric, type Signal, type Unit } from "@/lib/pendle/thesis";
import { fmtCompact, fmtDate, fmtPct, fmtUsdCompact } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel } from "./carousel";
import { InfoTip } from "./info-tip";
import { Eyebrow, SectionHeading } from "./primitives";

const fmtUnit = (n: number, unit: Unit) =>
  unit === "usd" ? fmtUsdCompact(n) : unit === "pct" ? fmtPct(n) : unit === "mult" ? `${n.toFixed(1)}×` : fmtCompact(n);

/** Passing signals draw in mint, failing ones in coral; benchmarks are always the neutral gold. */
const toneClass = (passing: boolean) => (passing ? "text-spendle" : "text-boost");
const barClass = (passing: boolean) => (passing ? "bg-spendle" : "bg-boost");

function Status({ passing }: { passing: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        passing ? "border-spendle/30 text-spendle" : "border-boost/30 text-boost",
      )}
    >
      {passing ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
      {passing ? "Passing" : "Not passing"}
    </span>
  );
}

/** Two bars on one scale: the value and its benchmark. */
function CompareMeter({ m, passing }: { m: Extract<Metric, { kind: "compare" }>; passing: boolean }) {
  const max = Math.max(m.value, m.benchmark);
  const rows: { label: string; n: number; cls: string }[] = [
    { label: m.valueLabel, n: m.value, cls: barClass(passing) },
    { label: m.benchmarkLabel, n: m.benchmark, cls: "bg-vependle/70" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground">
            <span>{r.label}</span>
            <span className="tabular shrink-0 text-foreground">{fmtUnit(r.n, m.unit)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", r.cls)} style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One track from 0 to 100% with the threshold marked. */
function ShareMeter({ m, passing }: { m: Extract<Metric, { kind: "share" }>; passing: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-1.5 w-full rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClass(passing))} style={{ width: `${m.value * 100}%` }} />
        <div
          className="absolute -top-1 h-3.5 w-px bg-vependle"
          style={{ left: `${m.threshold * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="relative h-4 text-[11px] text-muted-foreground">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2 text-vependle" style={{ left: `${m.threshold * 100}%` }}>
          {fmtPct(m.threshold, 0)} test
        </span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  );
}

/** A small area chart of a schedule, with labelled marks. */
function SeriesMeter({ m, passing }: { m: Extract<Metric, { kind: "series" }>; passing: boolean }) {
  const W = 320;
  const H = 56;
  const t0 = m.points[0].t;
  const t1 = m.points[m.points.length - 1].t;
  const vs = m.points.map((p) => p.v);
  const hi = Math.max(...vs);
  // Floor a quarter of the range below the minimum, never below zero, so a rise reads as a rise.
  const lo = Math.max(0, Math.min(...vs) - (hi - Math.min(...vs)) * 0.25);
  const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * (H - 6) - 3;
  const line = m.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const stroke = passing ? "var(--spendle)" : "var(--boost)";
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
          <path d={area} fill={stroke} fillOpacity={0.15} />
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {m.marks.map((k) => (
            <line
              key={k.label}
              x1={x(k.t)}
              x2={x(k.t)}
              y1={0}
              y2={H}
              stroke="var(--vependle)"
              strokeDasharray="3 3"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {m.marks.map((k) => (
          <span
            key={k.label}
            className="absolute top-0 -translate-x-full whitespace-nowrap pr-1.5 text-[11px] text-vependle"
            style={{ left: `${(x(k.t) / W) * 100}%` }}
          >
            {k.label}
          </span>
        ))}
      </div>
      <div className="flex justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{m.startLabel}</span>
        <span className="tabular text-foreground">{m.endLabel}</span>
      </div>
    </div>
  );
}

function Meter({ metric, passing }: { metric: Metric; passing: boolean }) {
  if (metric.kind === "compare") return <CompareMeter m={metric} passing={passing} />;
  if (metric.kind === "share") return <ShareMeter m={metric} passing={passing} />;
  return <SeriesMeter m={metric} passing={passing} />;
}

/** The rule and the numbers behind a signal, behind an info button beside its title. */
function About({ signal }: { signal: Signal }) {
  return (
    <InfoTip label={signal.title}>
      <span className="block">Test: {signal.test}.</span>
      <span className="mt-1.5 block text-muted-foreground">{signal.detail}</span>
    </InfoTip>
  );
}

function Title({ signal, className }: { signal: Signal; className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Eyebrow className={className}>{signal.title}</Eyebrow>
      <About signal={signal} />
    </div>
  );
}

function Figure({ signal, className }: { signal: Signal; className?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn("font-figure leading-none", toneClass(signal.passing), className)}>{signal.value}</span>
      {signal.caption && <span className="text-[11px] text-muted-foreground">{signal.caption}</span>}
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <Card
      id={`signal-${signal.id}`}
      size="sm"
      className={cn("w-full scroll-mt-24 border-l-2", signal.passing ? "border-l-spendle" : "border-l-boost")}
    >
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <Title signal={signal} />
          <Status passing={signal.passing} />
        </div>
        <Figure signal={signal} className="text-3xl" />
        <div className="mt-auto">
          <Meter metric={signal.metric} passing={signal.passing} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Ring showing how many signals pass, then the signals by name. Phones get dots instead of the list. */
function Scoreboard({ signals }: { signals: Signal[] }) {
  const n = signals.length;
  const pass = signals.filter((s) => s.passing).length;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col gap-5 lg:w-64">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 96 96" className="size-24 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke="var(--spendle)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(pass / n) * c} ${c}`}
          />
        </svg>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-figure text-4xl leading-none text-spendle">{pass}</span>
            <span className="font-figure text-2xl leading-none text-muted-foreground">/ {n}</span>
          </div>
          <div className="text-xs text-muted-foreground">signals passing their test</div>
          <ul className="flex flex-wrap gap-1.5 lg:hidden" aria-label="Signals">
            {signals.map((s) => (
              <li
                key={s.id}
                title={`${s.title}: ${s.passing ? "passing" : "not passing"}`}
                className={cn("size-2.5 rounded-full", s.passing ? "bg-spendle" : "bg-boost")}
              />
            ))}
          </ul>
        </div>
      </div>
      <ul className="hidden flex-col gap-1.5 border-t border-border pt-4 lg:flex" aria-label="Signals">
        {signals.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs">
            {s.passing ? (
              <Check className="size-3.5 shrink-0 text-spendle" aria-hidden="true" />
            ) : (
              <X className="size-3.5 shrink-0 text-boost" aria-hidden="true" />
            )}
            <a href={`#signal-${s.id}`} className={cn("hover:text-foreground", s.passing ? "text-muted-foreground" : "text-boost/90")}>
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Thesis({ data }: { data: TrackerData }) {
  const t = buildThesis(data);
  const all = [t.headline, ...t.passing, ...t.failing];
  const h = t.headline;

  return (
    <section id="thesis" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="08"
        title="Bullish $PENDLE Thesis"
        lede={
          <>
            Nine signals from the sections above, each judged against a stated test. Inputs: distribution{" "}
            {t.evaluated.distributionEpoch} ({fmtDate(t.evaluated.distributionAt)}) and the fee epoch from{" "}
            {fmtDate(t.evaluated.feeEpochStart)}.
          </>
        }
      />

      <Card
        id={`signal-${h.id}`}
        className={cn(
          "scroll-mt-24 border-l-2 bg-gradient-to-br to-transparent",
          h.passing ? "border-l-spendle from-spendle/10" : "border-l-boost from-boost/10",
        )}
      >
        <CardContent className="grid gap-8 py-2 lg:grid-cols-[auto_1fr] lg:gap-12">
          <Scoreboard signals={all} />
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Title signal={h} className={toneClass(h.passing)} />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={cn("font-figure text-5xl leading-none sm:text-6xl", toneClass(h.passing))}>{h.value}</span>
                  <span className="text-sm text-muted-foreground">{h.caption}</span>
                </div>
              </div>
              <Status passing={h.passing} />
            </div>
            <Meter metric={h.metric} passing={h.passing} />
            {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
          </div>
        </CardContent>
      </Card>

      <Carousel label="signals">
        {[...t.passing, ...t.failing].map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
      </Carousel>
    </section>
  );
}
