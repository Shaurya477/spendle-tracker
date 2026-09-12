import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtMult, fmtPct } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { DecayChart, DilutionChart } from "./charts";
import { Eyebrow, SectionHeading, Stat, Swatch } from "./primitives";

export function Dilution({ data }: { data: TrackerData }) {
  const { dilution, loyalty, sPendle, projection, unlocks, yield: y } = data;
  const biggest = [...unlocks].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const remainingNow = unlocks.reduce((s, u) => s + u.amount, 0);
  const oneYear = projection.find((p) => p.t >= data.block.timestamp + 365.25 * 86_400);

  return (
    <section id="dilution" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="03"
        title="Boost dilution"
        lede={
          <>
            Virtual sPENDLE shares the reward pool with real sPENDLE. Locked PENDLE counts 1×;
            everything above 1× is the loyalty boost, paid for by every 1× unit, sPENDLE and locked
            PENDLE alike. Each multiplier falls linearly to 1× at unlock, so the premium shrinks every
            day and reaches zero on{" "}
            <span className="tabular text-foreground">{fmtDate(loyalty.expiresAt)}</span>.
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Boost dilution today"
              value={fmtPct(dilution.premiumShare, 1)}
              tone="boost"
              size="lg"
              sub="share of each distribution taken by the boost premium; equal to the haircut on plain APR vs everyone at 1×"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Lockers' reward share"
              value={fmtPct(dilution.lockerShare, 1)}
              tone="vependle"
              size="lg"
              sub={`vs ${fmtPct(dilution.stakerShare, 1)} to plain stakers, who hold ${fmtCompact(sPendle.eligible)} eligible sPENDLE`}
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Plain APR, one year out"
              value={oneYear ? fmtPct(oneYear.aprPlainFlat) : "—"}
              tone="spendle"
              size="lg"
              sub={`from ${fmtPct(y.latest.aprPlain)} today, if each distribution stayed at the latest ${fmtCompact(y.latest.amount)} sPENDLE and sPENDLE supply stayed flat`}
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Average multiplier"
              value={fmtMult(loyalty.avgMultiplier)}
              size="lg"
              sub={`${fmtMult(loyalty.snapshot.avgMultiplier)} at the ${fmtDate(loyalty.snapshot.timestamp)} snapshot → 1.00× on the last unlock`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Projected virtual sPENDLE</Eyebrow>
                <p className="mt-1 text-xs text-muted-foreground">
                  Snapshot lock schedule replayed forward. Daily resolution; steps are weekly unlock
                  batches.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Swatch tone="vependle" /> 1× base
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch tone="boost" /> boost premium
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch tone="spendle" /> sPENDLE today
                </span>
              </div>
            </div>
            <DecayChart points={projection} sPendle={sPendle.eligible} expiresAt={loyalty.expiresAt} />
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Projected dilution &amp; plain APR</Eyebrow>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solid: sPENDLE supply held flat. Dashed: PENDLE restaked as sPENDLE the day its lock
                  expires. Right axis: plain APR if distributions stay at the latest amount.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Swatch tone="boost" /> dilution, flat
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch tone="vependle" /> dilution, restaked
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Swatch tone="spendle" /> plain APR
                </span>
              </div>
            </div>
            <DilutionChart points={projection} />
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <Eyebrow>Largest unlock weeks ahead</Eyebrow>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {fmtCompact(remainingNow)} snapshot-eligible PENDLE is still locked across{" "}
              {unlocks.length} weekly expiries. Most of it was max-locked in the final week before the
              snapshot and unlocks together in January 2028.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {biggest.map((u) => (
              <li
                key={u.expiry}
                className="flex items-baseline justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2"
              >
                <span className="tabular text-xs text-muted-foreground">{fmtDate(u.expiry)}</span>
                <span className="tabular text-sm text-vependle">
                  {fmtCompact(u.amount)}{" "}
                  <span className="text-[10px] text-muted-foreground">{fmtPct(u.amount / remainingNow, 0)}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
