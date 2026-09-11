import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtDays, fmtInt, fmtMult, fmtPct } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, SectionHeading, Stat, Swatch } from "./primitives";

export function Balances({ data }: { data: TrackerData }) {
  const { sPendle, vePendle, loyalty, combined } = data;
  const total = combined.hubTotalStaked;
  const pctS = sPendle.supply / total;
  const pctActive = vePendle.activeLocked / total;
  const pctExpired = vePendle.expiredUnwithdrawn / total;

  return (
    <section className="flex flex-col gap-8">
      <SectionHeading
        index="01"
        title="Two balances, not one"
        lede={
          <>
            Pendle&apos;s staking hub adds sPENDLE and legacy vePENDLE into a single{" "}
            <span className="tabular font-mono text-foreground">{fmtInt(total)}</span> &ldquo;total
            staked&rdquo;. Read straight from the contracts, they are two different things: liquid
            sPENDLE, and PENDLE still sitting in the deprecated vePENDLE escrow waiting to unlock.
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rise rise-1 relative overflow-hidden border-0 bg-card/80 ring-1 ring-spendle/20">
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-spendle/10 blur-3xl" />
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex items-center justify-between">
              <Eyebrow className="text-spendle">sPENDLE · staked</Eyebrow>
              <Badge variant="outline" className="font-mono text-[10px] text-spendle ring-spendle/30">
                live · liquid
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="tabular font-mono text-5xl leading-none tracking-tight text-spendle sm:text-6xl">
                {fmtInt(sPendle.supply)}
              </div>
              <div className="text-xs text-muted-foreground">
                sPENDLE supply · <code className="font-mono">totalSupply()</code> on the StakedPendle
                contract, 1:1 with PENDLE
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Reward-eligible"
                value={fmtCompact(sPendle.eligible)}
                sub={`supply minus ${fmtCompact(sPendle.unclaimedInDistributor)} unclaimed rewards parked in the Merkle distributor`}
              />
              <Stat
                label="In unstake queue"
                value={fmtCompact(sPendle.cooldownQueue)}
                unit="PENDLE"
                sub={`${sPendle.cooldownDays}-day cooldown; sPENDLE already burned, PENDLE not yet withdrawn`}
              />
              <Stat
                label="PENDLE in contract"
                value={fmtCompact(sPendle.pendleHeld)}
                sub={`instant unstake fee ${sPendle.instantFeePct}%`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rise rise-2 relative overflow-hidden border-0 bg-card/80 ring-1 ring-vependle/20">
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-vependle/10 blur-3xl" />
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex items-center justify-between">
              <Eyebrow className="text-vependle">vePENDLE · locked PENDLE</Eyebrow>
              <Badge variant="outline" className="font-mono text-[10px] text-vependle ring-vependle/30">
                deprecated · depleting
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <div className="tabular font-mono text-5xl leading-none tracking-tight text-vependle sm:text-6xl">
                {fmtInt(vePendle.pendleHeld)}
              </div>
              <div className="text-xs text-muted-foreground">
                PENDLE held by the VotingEscrow contract ·{" "}
                <code className="font-mono">PENDLE.balanceOf(vePENDLE)</code>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Under active lock"
                value={fmtCompact(vePendle.activeLocked)}
                sub={`unexpired locks, from the weekly slope schedule · last unlock ${fmtDate(vePendle.lastLiveExpiry)}`}
              />
              <Stat
                label="Expired, unwithdrawn"
                value={fmtCompact(vePendle.expiredUnwithdrawn)}
                sub="lock ended, owner has not called withdraw()"
              />
              <Stat
                label="vePENDLE balance"
                value={fmtCompact(vePendle.veBalance)}
                sub="time-decayed voting weight of all live locks"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rise rise-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>How the hub&apos;s combined figure splits</Eyebrow>
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
              label="Virtual sPENDLE (loyalty boost)"
              value={fmtCompact(loyalty.virtual)}
              tone="boost"
              size="lg"
              sub={`${fmtCompact(vePendle.snapshotLocked)} snapshot-eligible PENDLE × ${fmtMult(loyalty.avgMultiplier)} average multiplier`}
            />
          </CardContent>
        </Card>
        <Card size="sm" className="border-0 bg-card/60">
          <CardContent>
            <Stat
              label="Boost premium"
              value={fmtCompact(loyalty.premium)}
              size="lg"
              sub="virtual sPENDLE above a 1:1 count of the locked PENDLE — the part that dilutes"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="border-0 bg-card/60">
          <CardContent>
            <Stat
              label="Reward-eligible total"
              value={fmtCompact(combined.rewardEligible)}
              size="lg"
              sub="eligible sPENDLE + virtual sPENDLE; the denominator every epoch's rewards are split over"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="border-0 bg-card/60">
          <CardContent>
            <Stat
              label="Boost fully expires"
              value={fmtDate(loyalty.expiresAt)}
              size="lg"
              sub={`${fmtDays(loyalty.maxRemainingDays)} left · virtual balance falls ~${fmtCompact(loyalty.decayPerDay)} per day between unlocks`}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
