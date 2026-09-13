import type { TrackerData } from "@/lib/pendle/tracker";
import { EPOCHS_PER_YEAR } from "@/lib/pendle/config";
import { fmtCompact, fmtDate, fmtDateTime, fmtInt, fmtMult, fmtPct, fmtUsd, fmtUsdPrice, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, SectionHeading, Stat, TxLink } from "./primitives";

const EPY = EPOCHS_PER_YEAR.toFixed(2);

export function Yield({ data }: { data: TrackerData }) {
  const { yield: y, loyalty, block, sPendle, vePendle } = data;
  const latest = y.latest;
  const overdue = y.nextDistributionEta < block.timestamp;

  return (
    <section id="yield" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="03"
        title="sPENDLE yield"
        methodId="method-rewards"
        lede={
          <>
            About every 14 days the buyback contract stakes the PENDLE it bought with fees and pays the
            new sPENDLE out pro-rata over eligible plus virtual sPENDLE: stakers at 1×, lockers at their
            multiplier.
          </>
        }
      />

      <div className="grid gap-4 rounded-xl border border-border/70 bg-background/40 p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow tip="Rewards are paid in the asset that is staked, so PENDLE's dollar price cancels out of the ratio. Unclaimed rewards keep earning, so they count in the denominator. Holdings elsewhere on this page use the live USD quote; APR does not.">
              Denomination
            </Eyebrow>
            <Badge variant="outline" className="text-[11px] text-spendle ring-spendle/30">
              token terms
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            APR = sPENDLE distributed ÷ (all sPENDLE + virtual sPENDLE); PENDLE&apos;s price cancels out.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow tip="One epoch is 14 days, so a year has 365.25 ÷ 14 = 26.09 epochs. Simple interest: rewards are not assumed to be restaked.">
            Annualisation
          </Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Per-epoch ratio × {EPY} (365.25 ÷ 14). Simple, not compounded.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow
            tip={`Each per-epoch APR uses the eligible total as it stood just before that distribution. Trailing is the arithmetic mean of the last ${y.trailing.epochs} of them.`}
          >
            Averaging
          </Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Latest = the most recent distribution. Trailing = mean of the last {y.trailing.epochs} per-epoch APRs.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Card className="">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-spendle">Plain sPENDLE staker</Eyebrow>
              <span className="text-[11px] text-muted-foreground">sPENDLE earned per sPENDLE held, per year</span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <Stat
                label="Latest epoch APR"
                value={fmtPct(latest.aprPlain)}
                tone="spendle"
                size="lg"
                sub={`${fmtInt(latest.amount)} sPENDLE ÷ ${fmtCompact(latest.eligibleTotal)} eligible × ${EPY}; epoch ${latest.epoch}, ${fmtDate(latest.timestamp)}`}
              />
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprPlain)}
                size="lg"
                sub={`mean over ${fmtDate(y.trailing.from)} → ${fmtDate(y.trailing.to)}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label="If lockers counted 1×"
                value={fmtPct(y.aprNoBoost)}
                sub={`latest ÷ (${fmtCompact(sPendle.eligible)} sPENDLE + ${fmtCompact(vePendle.snapshotLocked)} locked PENDLE) × ${EPY}`}
                tip="The latest distribution split over today's sPENDLE plus today's snapshot-locked PENDLE at 1×, with no boost premium. Mixes the latest payout with today's balances."
              />
              <Stat
                label="If only sPENDLE existed"
                value={fmtPct(y.aprSolo)}
                sub={`latest ÷ ${fmtCompact(sPendle.eligible)} sPENDLE × ${EPY}; assumes unlocking PENDLE is not restaked`}
                tip="Plain APR once every snapshot lock has unlocked, if none of that PENDLE is restaked and each distribution stays at the latest amount."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow
                className="text-boost"
                tip="Rewards arrive as sPENDLE while the principal stays locked as PENDLE; both are PENDLE 1:1, so the ratio is still price-free."
              >
                Boosted vePENDLE locker
              </Eyebrow>
              <span className="text-[11px] text-muted-foreground">sPENDLE earned per PENDLE locked, per year</span>
            </div>
            <Stat
              label="Latest, average locker"
              value={fmtPct(latest.aprBoostedAvg)}
              tone="boost"
              size="lg"
              sub={`plain ${fmtPct(latest.aprPlain)} × ${fmtMult(latest.avgMultiplier)} average multiplier at the time`}
            />
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprBoostedAvg)}
                sub={`same ${y.trailing.epochs} epochs, each plain × that epoch's multiplier`}
              />
              <Stat
                label="Longest lock today"
                value={fmtPct(y.aprMaxBoosted)}
                sub={`plain ${fmtPct(latest.aprPlain)} × ${fmtMult(loyalty.maxMultiplier)}, today's multiplier of the lock unlocking ${fmtDate(loyalty.expiresAt)}`}
                tip={`Plain APR at the latest distribution × the multiplier a lock unlocking on ${fmtDate(loyalty.expiresAt)} has today. Mixes the latest payout with today's multiplier.`}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Multipliers fall to 1× at unlock; a lock ending next week is already ~1×. The average snapshot
              lock has {((loyalty.avgMultiplier - 1) / 3 * 2).toFixed(1)} years left, which is what the{" "}
              {fmtMult(loyalty.avgMultiplier)} average multiplier means.
            </p>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-6">
            <Eyebrow>Latest reward flow</Eyebrow>
            <Stat
              label="Distributed"
              value={fmtInt(latest.amount)}
              unit="sPENDLE"
              size="lg"
              sub={
                <>
                  bought for {fmtUsd(latest.usdtSpent)} USDT at {fmtUsdPrice(latest.usdtSpent / latest.pendleBought)} average;{" "}
                  {fmtDateTime(latest.timestamp)}, tx <TxLink hash={latest.txHash} />
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
                sub={overdue ? "14 days have passed; due any time" : "≈ 14 days after the last"}
              />
            </div>
            <div className="border-t border-border pt-4">
              <Stat
                label="Distributed since launch"
                value={fmtInt(y.totalDistributed)}
                unit="sPENDLE"
                sub={`${data.distributions.length} distributions; bought for ${fmtUsd(y.totalBuybackUsd)} USDT in total`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
