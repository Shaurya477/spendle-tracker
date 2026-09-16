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
            <Eyebrow>Denomination</Eyebrow>
            <Badge variant="outline" className="text-[11px] text-spendle ring-spendle/30">
              token terms
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            APR = sPENDLE distributed ÷ (all sPENDLE + virtual sPENDLE); PENDLE&apos;s price cancels out.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Annualisation</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Per-epoch ratio × {EPY} (365.25 ÷ 14). Simple, not compounded.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Averaging</Eyebrow>
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
                sub={`epoch ${latest.epoch}, ${fmtDate(latest.timestamp)}`}
                tip={`What one sPENDLE with no lock earns: ${fmtInt(latest.amount)} sPENDLE distributed ÷ ${fmtCompact(latest.eligibleTotal)} eligible (all sPENDLE + virtual) in the block before × ${EPY}. Every sPENDLE takes the same share, so this is the floor every staker gets; one epoch's number, so a strong or weak fortnight shows here first.`}
              />
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprPlain)}
                size="lg"
                sub={`${fmtDate(y.trailing.from)} → ${fmtDate(y.trailing.to)}`}
                tip={`Mean of the last ${y.trailing.epochs} per-epoch plain APRs, each against the eligible total of its own epoch. Smooths the fortnight-to-fortnight swing in fees; about three months.`}
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label="If lockers counted 1×"
                value={fmtPct(y.aprNoBoost)}
                tip={`The latest distribution split over today's ${fmtCompact(sPendle.eligible)} sPENDLE plus ${fmtCompact(vePendle.snapshotLocked)} snapshot-locked PENDLE at 1×, no boost premium, × ${EPY}. Mixes the latest payout with today's balances.`}
              />
              <Stat
                label="If only sPENDLE existed"
                value={fmtPct(y.aprSolo)}
                tip={`Plain APR once every snapshot lock has unlocked: the latest distribution ÷ today's ${fmtCompact(sPendle.eligible)} sPENDLE × ${EPY}, if none of the unlocking PENDLE is restaked and each distribution stays at the latest amount.`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-boost">Boosted vePENDLE locker</Eyebrow>
              <span className="text-[11px] text-muted-foreground">sPENDLE earned per PENDLE locked, per year</span>
            </div>
            <Stat
              label="Latest, average locker"
              value={fmtPct(latest.aprBoostedAvg)}
              tone="boost"
              size="lg"
              sub={`plain ${fmtPct(latest.aprPlain)} × ${fmtMult(latest.avgMultiplier)}`}
              tip="Plain APR of the latest distribution × the average multiplier across snapshot locks at that moment. Rewards arrive as sPENDLE on PENDLE principal, both PENDLE 1:1, so the ratio is price-free. A lock with more time left than average earns more than this, one with less earns less."
            />
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat
                label={`Trailing ${y.trailing.epochs} epochs`}
                value={fmtPct(y.trailing.aprBoostedAvg)}
                tip={`Mean of the last ${y.trailing.epochs} boosted APRs, each that epoch's plain APR × the average multiplier at that time. The multiplier falls every epoch, so this sits above the latest figure.`}
              />
              <Stat
                label="Longest lock today"
                value={fmtPct(y.aprMaxBoosted)}
                sub={`plain ${fmtPct(latest.aprPlain)} × ${fmtMult(loyalty.maxMultiplier)}`}
                tip={`Plain APR at the latest distribution × the multiplier a lock unlocking on ${fmtDate(loyalty.expiresAt)}, the last on the snapshot schedule, has today. Mixes the latest payout with today's multiplier.`}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The average snapshot lock has {((loyalty.avgMultiplier - 1) / 3 * 2).toFixed(1)} years left ({fmtMult(loyalty.avgMultiplier)});
              multipliers reach 1× at unlock.
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
              tip="PENDLE the buyback contract staked in the latest distribution transaction; the sPENDLE it received went to the rewards distributor for stakers to claim. The USDT figure is what the contract spent on swaps between the previous distribution and this one, so the average is a weekly TWAP price, not a print."
              sub={
                <>
                  {fmtUsd(latest.usdtSpent)} USDT at {fmtUsdPrice(latest.usdtSpent / latest.pendleBought)};{" "}
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
                tip="PENDLE bought back and still in the buyback contract. The hourly TWAP accumulates it between distributions; at the next one it is staked and paid out, so this is a floor for the next payout, not the whole of it."
              />
              <Stat
                label="Next distribution"
                value={fmtDate(y.nextDistributionEta)}
                sub={overdue ? "14 days have passed; due any time" : "≈ 14 days after the last"}
                tip="The latest distribution's timestamp + 14 days. So far distributions have landed on alternate Fridays with gaps between 11.5 and 17 days, so this is an expectation, not a contract deadline."
              />
            </div>
            <div className="border-t border-border pt-4">
              <Stat
                label="Distributed since launch"
                value={fmtInt(y.totalDistributed)}
                unit="sPENDLE"
                sub={`${data.distributions.length} distributions; ${fmtUsd(y.totalBuybackUsd)} USDT spent`}
                tip="Every distribution since the sPENDLE launch on 29 Jan 2026 summed, with the USDT the buyback contract spent to acquire it. What that PENDLE is worth today is in the Valuation section."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
