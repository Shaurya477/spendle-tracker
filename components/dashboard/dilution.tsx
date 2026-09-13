import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtMult, fmtPct } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { DecayChart, DilutionChart } from "./charts";
import { Eyebrow, LineSwatch, SectionHeading, Stat, Swatch } from "./primitives";

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
        methodId="method-virtual"
        lede={
          <>
            Virtual sPENDLE shares the reward pool with real sPENDLE; the part above a 1× count of
            locked PENDLE is the boost premium, paid by every 1× unit. Multipliers fall linearly to 1×
            at unlock, so the premium reaches zero on{" "}
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
              sub="share of each distribution taken by the boost premium"
              tip="Boost premium ÷ reward-eligible total. It is also how much lower plain APR is than it would be with every unit counted at 1×."
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
              sub={`from ${fmtPct(y.latest.aprPlain)} today; latest distribution and sPENDLE supply held flat`}
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
              <Eyebrow tip="The snapshot lock schedule replayed forward at daily resolution; the steps are weekly unlock batches. Locks changed after the snapshot do not affect the boost.">
                Projected virtual sPENDLE
              </Eyebrow>
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
              <Eyebrow tip="Flat: sPENDLE supply held at today's. Restaked: unlocking PENDLE staked as sPENDLE the day its lock expires. Plain APR, right axis: each distribution held at the latest amount.">
                Projected dilution &amp; plain APR
              </Eyebrow>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <LineSwatch tone="boost" /> dilution, sPENDLE flat
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LineSwatch tone="vependle" dashed /> dilution, unlocks restaked
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LineSwatch tone="spendle" /> plain APR, right axis
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
              {fmtCompact(remainingNow)} snapshot PENDLE still locked across {unlocks.length} weekly
              expiries; most was max-locked just before the snapshot and unlocks in January 2028.
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
