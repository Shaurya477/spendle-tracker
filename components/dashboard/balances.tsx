import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtDays, fmtInt, fmtMult, fmtPct, usdOf } from "@/lib/format";
import { MigrationChart } from "./charts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, LineSwatch, SectionHeading, Stat, Swatch } from "./primitives";

export function Balances({ data }: { data: TrackerData }) {
  const { sPendle, vePendle, loyalty, combined, pendleUsd, migration } = data;
  const total = combined.hubTotalStaked;
  const m = migration.totals;
  const first = migration.weeks[0];
  const last = migration.weeks[migration.weeks.length - 1];
  const restakeRate = m.settledRestaked / m.settled;
  const pctS = sPendle.supply / total;
  const pctActive = vePendle.activeLocked / total;
  const pctExpired = vePendle.expiredUnwithdrawn / total;

  return (
    <section id="balances" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="01"
        title="Staked vs locked"
        lede={
          <>
            Pendle&apos;s staking hub reports one &ldquo;total staked&rdquo; figure,{" "}
            <span className="tabular text-foreground">{fmtInt(total)}</span>{" "}
            <span className="tabular text-foreground/70">({usdOf(total, pendleUsd)})</span>.
            Onchain that is two balances: liquid sPENDLE, and PENDLE still sitting in the old vePENDLE lock
            contract.
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-spendle">sPENDLE staked</Eyebrow>
              <Badge variant="outline" className="text-[11px] text-spendle ring-spendle/30">
                live, liquid
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="font-figure text-5xl leading-none tracking-tight text-spendle sm:text-6xl">
                {fmtInt(sPendle.supply)}
              </div>
              <div className="tabular text-lg text-muted-foreground">
                {usdOf(sPendle.supply, pendleUsd)}
              </div>
              <div className="text-xs text-muted-foreground">
                All sPENDLE in existence, read from the staking contract. Each one is backed by one
                PENDLE, and every one earns rewards, claimed or not.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Unclaimed rewards"
                value={fmtCompact(sPendle.unclaimedInDistributor)}
                usd={usdOf(sPendle.unclaimedInDistributor, pendleUsd)}
                sub="distributed sPENDLE not yet claimed; it keeps earning for its owners, so it counts in the supply above"
              />
              <Stat
                label="In cooldown"
                value={fmtCompact(sPendle.cooldownQueue)}
                unit="PENDLE"
                usd={usdOf(sPendle.cooldownQueue, pendleUsd)}
                sub={`sPENDLE already burned; PENDLE withdrawable ${sPendle.cooldownDays} days after unstaking`}
              />
              <Stat
                label="PENDLE in contract"
                value={fmtCompact(sPendle.pendleHeld)}
                usd={usdOf(sPendle.pendleHeld, pendleUsd)}
                sub={`sPENDLE supply + cooldown queue; instant unstake fee ${sPendle.instantFeePct}%`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-vependle">Locked in vePENDLE</Eyebrow>
              <Badge variant="outline" className="text-[11px] text-vependle ring-vependle/30">
                deprecated, depleting
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="font-figure text-5xl leading-none tracking-tight text-vependle sm:text-6xl">
                {fmtInt(vePendle.pendleHeld)}
              </div>
              <div className="tabular text-lg text-muted-foreground">
                {usdOf(vePendle.pendleHeld, pendleUsd)}
              </div>
              <div className="text-xs text-muted-foreground">
                PENDLE sitting in the old vePENDLE lock contract, whether the lock is still running or
                has ended
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Under active lock"
                value={fmtCompact(vePendle.activeLocked)}
                usd={usdOf(vePendle.activeLocked, pendleUsd)}
                sub={`from the contract's unlock schedule; last unlock ${fmtDate(vePendle.lastLiveExpiry)}${vePendle.lastLiveExpiry > loyalty.expiresAt ? ", after the boost ends: one lock was extended after the snapshot, its boost terms stay fixed" : ""}`}
              />
              <Stat
                label="Expired, unwithdrawn"
                value={fmtCompact(vePendle.expiredUnwithdrawn)}
                usd={usdOf(vePendle.expiredUnwithdrawn, pendleUsd)}
                sub="lock has ended but the owner has not withdrawn the PENDLE yet"
              />
              <Stat
                label="vePENDLE balance"
                value={fmtCompact(vePendle.veBalance)}
                sub="time-decayed voting weight of all live locks, not a PENDLE quantity"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>How total staked splits</Eyebrow>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Swatch tone="spendle" /> sPENDLE {fmtPct(pctS, 1)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch tone="vependle" /> vePENDLE active {fmtPct(pctActive, 1)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch tone="muted" /> expired {fmtPct(pctExpired, 1)}
            </span>
          </div>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-sm bg-muted">
          <div className="bg-spendle" style={{ width: `${pctS * 100}%` }} />
          <div className="bg-vependle" style={{ width: `${pctActive * 100}%` }} />
          <div className="bg-muted-foreground/50" style={{ width: `${pctExpired * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Virtual sPENDLE"
              value={fmtCompact(loyalty.virtual)}
              tone="boost"
              size="lg"
              sub={`loyalty boost: ${fmtCompact(vePendle.snapshotLocked)} snapshot-eligible PENDLE still locked × ${fmtMult(loyalty.avgMultiplier)} average multiplier`}
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Boost premium"
              value={fmtCompact(loyalty.premium)}
              size="lg"
              sub="virtual sPENDLE above a 1× count of the locked PENDLE; the part that dilutes stakers"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Reward-eligible total"
              value={fmtCompact(combined.rewardEligible)}
              size="lg"
              sub="all sPENDLE, unclaimed rewards included, + virtual sPENDLE; the denominator every epoch's rewards are split over"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Boost ends"
              value={fmtDate(loyalty.expiresAt)}
              size="lg"
              sub={`${fmtDays(loyalty.maxRemainingDays)} left, fixed by the snapshot schedule; virtual balance falls ~${fmtCompact(loyalty.decayPerDay)} per day between unlocks`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1.5">
              <Eyebrow>From vePENDLE to sPENDLE</Eyebrow>
              <p className="max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
                There is no conversion. When a lock expires the PENDLE is withdrawn, and staking it is
                a separate step the holder may or may not take. Bars: PENDLE withdrawn each week, split
                by whether the same wallet staked it within 30 days. Lines: PENDLE still locked and
                sPENDLE supply.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Swatch tone="spendle" /> restaked within 30 d
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch tone="vependle" /> not restaked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LineSwatch tone="vependle" /> PENDLE in vePENDLE
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LineSwatch tone="spendle" /> sPENDLE supply
              </span>
            </div>
          </div>
          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
            <Stat
              label="Withdrawn since the snapshot"
              value={fmtCompact(m.withdrawn)}
              unit="PENDLE"
              sub={`by ${fmtInt(m.wallets)} wallets; PENDLE in vePENDLE went ${fmtCompact(first.vePendle)} → ${fmtCompact(last.vePendle)}`}
            />
            <Stat
              label="Restaked as sPENDLE"
              value={fmtPct(restakeRate, 0)}
              tone="spendle"
              sub={`${fmtCompact(m.restaked)} PENDLE by ${fmtInt(m.restakers)} of those wallets, within 30 days of withdrawing; the rest stayed liquid`}
            />
            <Stat
              label="sPENDLE supply since the snapshot"
              value={`${fmtCompact(first.sPendle)} → ${fmtCompact(last.sPendle)}`}
              tone="spendle"
              sub={`${fmtCompact(last.sPendle - first.sPendle)} more; restaked locks are ${fmtPct(m.restaked / (last.sPendle - first.sPendle), 0)} of that, the rest is new staking and distributed rewards`}
            />
          </div>
          <MigrationChart weeks={migration.weeks} />
        </CardContent>
      </Card>
    </section>
  );
}
