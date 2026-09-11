import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtDays, fmtInt, fmtMult, fmtPct, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, SectionHeading, Stat, Swatch } from "./primitives";

export function Balances({ data }: { data: TrackerData }) {
  const { sPendle, vePendle, loyalty, combined, pendleUsd } = data;
  const total = combined.hubTotalStaked;
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
            <span className="tabular font-mono text-foreground">{fmtInt(total)}</span>{" "}
            <span className="tabular font-mono text-foreground/70">({usdOf(total, pendleUsd)})</span>.
            Onchain that is two balances: liquid sPENDLE, and PENDLE still sitting in the old vePENDLE lock
            contract.
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rise rise-1 relative overflow-hidden border-0 bg-card/80 ring-1 ring-spendle/20">
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-spendle/10 blur-3xl" />
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-spendle">sPENDLE staked</Eyebrow>
              <Badge variant="outline" className="font-mono text-[10px] text-spendle ring-spendle/30">
                live, liquid
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="tabular font-mono text-5xl leading-none tracking-tight text-spendle sm:text-6xl">
                {fmtInt(sPendle.supply)}
              </div>
              <div className="tabular font-mono text-lg text-muted-foreground">
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

        <Card className="rise rise-2 relative overflow-hidden border-0 bg-card/80 ring-1 ring-vependle/20">
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-vependle/10 blur-3xl" />
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-vependle">Locked in vePENDLE</Eyebrow>
              <Badge variant="outline" className="font-mono text-[10px] text-vependle ring-vependle/30">
                deprecated, depleting
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="tabular font-mono text-5xl leading-none tracking-tight text-vependle sm:text-6xl">
                {fmtInt(vePendle.pendleHeld)}
              </div>
              <div className="tabular font-mono text-lg text-muted-foreground">
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

      <div className="rise rise-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>How total staked splits</Eyebrow>
          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
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

      <div className="rise rise-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm" className="border-0 bg-card/60 ring-1 ring-boost/25">
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
        <Card size="sm" className="border-0 bg-card/60">
          <CardContent>
            <Stat
              label="Boost premium"
              value={fmtCompact(loyalty.premium)}
              size="lg"
              sub="virtual sPENDLE above a 1× count of the locked PENDLE; the part that dilutes stakers"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="border-0 bg-card/60">
          <CardContent>
            <Stat
              label="Reward-eligible total"
              value={fmtCompact(combined.rewardEligible)}
              size="lg"
              sub="all sPENDLE, unclaimed rewards included, + virtual sPENDLE; the denominator every epoch's rewards are split over"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="border-0 bg-card/60">
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
    </section>
  );
}
