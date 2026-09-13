import type { TrackerData } from "@/lib/pendle/tracker";
import { buildThesis, type Signal } from "@/lib/pendle/thesis";
import { fmtDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, SectionHeading } from "./primitives";

function SignalCard({ signal, tone }: { signal: Signal; tone: "spendle" | "vependle" | "boost" }) {
  return (
    <Card size="sm" className="">
      <CardContent className="flex flex-col gap-2">
        <Eyebrow>{signal.title}</Eyebrow>
        <div
          className={`font-figure text-2xl leading-none tracking-tight sm:text-3xl ${
            tone === "spendle" ? "text-spendle" : tone === "vependle" ? "text-vependle" : "text-boost"
          }`}
        >
          {signal.value}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{signal.detail}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">Test: {signal.test}</p>
      </CardContent>
    </Card>
  );
}

export function Thesis({ data }: { data: TrackerData }) {
  const t = buildThesis(data);
  const tones: Array<"spendle" | "vependle" | "boost"> = ["spendle", "vependle", "boost"];

  return (
    <section id="thesis" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="06"
        title="Bullish $PENDLE Thesis"
        lede={
          <>
            Each signal is computed from the sections above and judged against a stated test; failures
            are listed, not dropped. Inputs: distribution {t.evaluated.distributionEpoch} (
            {fmtDate(t.evaluated.distributionAt)}) and the fee epoch from{" "}
            {fmtDate(t.evaluated.feeEpochStart)}.
          </>
        }
      />

      <Card
        className={`relative overflow-hidden ring-1 ${
          t.headline.passing ? "ring-spendle/30" : "ring-boost/30"
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-10 -top-16 size-56 rounded-full blur-3xl ${
            t.headline.passing ? "bg-spendle/10" : "bg-boost/10"
          }`}
        />
        <CardContent className="flex flex-col gap-5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow className={t.headline.passing ? "text-spendle" : "text-boost"}>{t.headline.title}</Eyebrow>
            <Badge
              variant="outline"
              className={`text-[11px] ${
                t.headline.passing ? "text-spendle ring-spendle/30" : "text-boost ring-boost/30"
              }`}
            >
              {t.headline.passing ? "net buyback" : "net emission"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div
              className={`font-figure text-5xl leading-none tracking-tight sm:text-6xl ${
                t.headline.passing ? "text-spendle" : "text-boost"
              }`}
            >
              {t.headline.value}
            </div>
            <div className="text-sm text-muted-foreground">PENDLE bought back per PENDLE emitted, per epoch</div>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t.headline.detail}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground/70">Test: {t.headline.test}</p>
        </CardContent>
      </Card>

      {t.passing.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {t.passing.map((s, i) => (
            <SignalCard key={s.id} signal={s} tone={tones[i % tones.length]} />
          ))}
        </div>
      )}

      {t.failing.length > 0 && (
        <div className="flex flex-col gap-3">
          <Eyebrow>Not in the thesis right now</Eyebrow>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border/70 bg-background/40">
            {t.failing.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-baseline sm:gap-4">
                <span className="w-56 shrink-0 text-xs font-medium text-foreground/80">{s.title}</span>
                <span className="leading-relaxed">
                  {s.detail} <span className="text-[11px] text-muted-foreground/70">Test: {s.test}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
