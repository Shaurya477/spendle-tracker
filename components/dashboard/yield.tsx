import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtDateTime, fmtInt, fmtMult, fmtPct } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Eyebrow, SectionHeading, Stat, TxLink } from "./primitives";

export function Yield({ data }: { data: TrackerData }) {
  const { yield: y, loyalty, block } = data;
  const latest = y.latest;
  const overdue = y.nextDistributionEta < block.timestamp;

  return (
    <section className="flex flex-col gap-8">
      <SectionHeading
        index="02"
        title="What each side earns"
        lede={
          <>
            Every two weeks the buyback contract stakes the PENDLE it bought with protocol fees and
            hands the minted sPENDLE to the Merkle distributor. That amount, split pro-rata over
            eligible sPENDLE plus virtual sPENDLE, is the yield. A plain staker gets a 1× share; a
            vePENDLE locker gets their multiplier times that.
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Card className="rise rise-1 border-0 bg-card/80 ring-1 ring-spendle/20">
          <CardContent className="flex flex-col gap-6">
            <Eyebrow className="text-spendle">Plain sPENDLE staker</Eyebrow>
            <div className="grid grid-cols-2 gap-6">
              <Stat
                label="Latest epoch APR"
                value={fmtPct(latest.aprPlain)}
                tone="spendle"
                size="lg"
                sub={`epoch ${latest.epoch}, distributed ${fmtDate(latest.timestamp)}`}
              />
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprPlain)}
                size="lg"
                sub={`mean of per-epoch APRs, ${fmtDate(y.trailing.from)} → ${fmtDate(y.trailing.to)}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label="If lockers counted 1×"
                value={fmtPct(y.aprNoBoost)}
                sub="same rewards, loyalty boost removed"
              />
              <Stat
                label="If only sPENDLE existed"
                value={fmtPct(y.aprSolo)}
                sub="where plain APR lands once every lock has expired"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rise rise-2 border-0 bg-card/80 ring-1 ring-boost/25">
          <CardContent className="flex flex-col gap-6">
            <Eyebrow className="text-boost">Boosted vePENDLE locker</Eyebrow>
            <Stat
              label="Average locker, latest epoch"
              value={fmtPct(latest.aprBoostedAvg)}
              tone="boost"
              size="lg"
              sub={`${fmtMult(latest.avgMultiplier)} average multiplier at that epoch`}
            />
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprBoostedAvg)}
                sub="average locker"
              />
              <Stat
                label="Longest lock today"
                value={fmtPct(y.aprMaxBoosted)}
                sub={`${fmtMult(loyalty.maxMultiplier)} · unlocks ${fmtDate(loyalty.expiresAt)}`}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              APR is on the PENDLE actually locked, paid in sPENDLE. A locker with the maximum lock
              remaining earns the most; someone unlocking next week is already back at ~1×.
            </p>
          </CardContent>
        </Card>

        <Card className="rise rise-3 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-6">
            <Eyebrow>Reward flow · latest</Eyebrow>
            <Stat
              label="Distributed"
              value={fmtInt(latest.amount)}
              unit="sPENDLE"
              size="lg"
              sub={
                <>
                  {fmtDateTime(latest.timestamp)} · tx <TxLink hash={latest.txHash} />
                </>
              }
            />
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label="Awaiting distribution"
                value={fmtCompact(y.pendingBuyback)}
                unit="PENDLE"
                sub="bought back, still in the buyback contract"
              />
              <Stat
                label="Next distribution"
                value={fmtDate(y.nextDistributionEta)}
                sub={overdue ? "14 days since the last one have passed; due any time" : "≈ 14 days after the last"}
              />
            </div>
            <div className="border-t border-border pt-4">
              <Stat
                label="Distributed since launch"
                value={fmtInt(y.totalDistributed)}
                unit="sPENDLE"
                sub={`${data.distributions.length} epochs`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
