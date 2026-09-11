import type { TrackerData } from "@/lib/pendle/tracker";
import { EPOCHS_PER_YEAR } from "@/lib/pendle/config";
import { fmtCompact, fmtDate, fmtDateTime, fmtInt, fmtMult, fmtPct, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, SectionHeading, Stat, TxLink } from "./primitives";

const EPY = EPOCHS_PER_YEAR.toFixed(2);

export function Yield({ data }: { data: TrackerData }) {
  const { yield: y, loyalty, block, sPendle, vePendle } = data;
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

      <div className="rise rise-1 grid gap-4 rounded-xl border border-border/70 bg-background/40 p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow>Denomination</Eyebrow>
            <Badge variant="outline" className="font-mono text-[10px] text-spendle ring-spendle/30">
              token terms
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            APR = sPENDLE distributed ÷ (eligible sPENDLE + virtual sPENDLE). Rewards are paid in
            the asset that is staked, so PENDLE&apos;s dollar price cancels out of the ratio. Holdings
            elsewhere on this page use the live USD quote; APR does not.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Annualisation</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            One epoch = 14 days. Each epoch&apos;s ratio is multiplied by 365.25 ÷ 14 = {EPY}.
            Simple, not compounded: nothing is assumed about restaking rewards.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Averaging</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            &ldquo;Latest&rdquo; is the most recent distribution alone. &ldquo;Trailing&rdquo; is the
            arithmetic mean of the last {y.trailing.epochs} per-epoch APRs, each with its own
            denominator at that block.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Card className="rise rise-2 border-0 bg-card/80 ring-1 ring-spendle/20">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-spendle">Plain sPENDLE staker</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">sPENDLE earned per sPENDLE held, per year</span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Stat
                label="Latest epoch APR"
                value={fmtPct(latest.aprPlain)}
                tone="spendle"
                size="lg"
                sub={`${fmtInt(latest.amount)} sPENDLE ÷ ${fmtCompact(latest.eligibleTotal)} eligible × ${EPY} · epoch ${latest.epoch}, ${fmtDate(latest.timestamp)}`}
              />
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprPlain)}
                size="lg"
                sub={`mean of ${y.trailing.epochs} per-epoch APRs, ${fmtDate(y.trailing.from)} → ${fmtDate(y.trailing.to)} · token terms`}
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label="If lockers counted 1×"
                value={fmtPct(y.aprNoBoost)}
                sub={`latest payout ÷ (${fmtCompact(sPendle.eligible)} sPENDLE + ${fmtCompact(vePendle.snapshotLocked)} locked PENDLE) × ${EPY}`}
              />
              <Stat
                label="If only sPENDLE existed"
                value={fmtPct(y.aprSolo)}
                sub={`latest payout ÷ ${fmtCompact(sPendle.eligible)} sPENDLE × ${EPY} · where plain APR lands after the last unlock`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rise rise-3 border-0 bg-card/80 ring-1 ring-boost/25">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-boost">Boosted vePENDLE locker</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">sPENDLE earned per PENDLE locked, per year</span>
            </div>
            <Stat
              label="Average locker, latest epoch"
              value={fmtPct(latest.aprBoostedAvg)}
              tone="boost"
              size="lg"
              sub={`plain ${fmtPct(latest.aprPlain)} × ${fmtMult(latest.avgMultiplier)} average multiplier at that block · token terms`}
            />
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprBoostedAvg)}
                sub={`mean of ${y.trailing.epochs} per-epoch boosted APRs, each = plain × that epoch's average multiplier`}
              />
              <Stat
                label="Longest lock today"
                value={fmtPct(y.aprMaxBoosted)}
                sub={`plain ${fmtPct(latest.aprPlain)} × ${fmtMult(loyalty.maxMultiplier)} · unlocks ${fmtDate(loyalty.expiresAt)}`}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Rewards arrive as sPENDLE while the principal stays locked as PENDLE; both are PENDLE
              1:1, so the ratio is still price-free. A locker unlocking next week is already back
              at ~1×.
            </p>
          </CardContent>
        </Card>

        <Card className="rise rise-4 border-0 bg-card/80">
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
                usd={usdOf(y.pendingBuyback, data.pendleUsd)}
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
