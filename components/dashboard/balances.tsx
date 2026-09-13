import type { TrackerData } from "@/lib/pendle/tracker";
import type { Move } from "@/lib/pendle/chain";
import { fmtCompact, fmtDate, fmtDays, fmtInt, fmtMult, fmtPct, usdOf } from "@/lib/format";
import { FlowsChart, MigrationChart } from "./charts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddressLink, Eyebrow, LineSwatch, SectionHeading, Stat, Swatch, TxLink } from "./primitives";

const MOVE_LABEL: Record<Move["kind"], string> = {
  stake: "Staked",
  cooldown: "To cooldown",
  instant: "Instant unstake",
  withdraw: "Lock withdrawn",
};
const MOVE_TONE: Record<Move["kind"], string> = {
  stake: "text-spendle ring-spendle/30",
  cooldown: "text-vependle ring-vependle/30",
  instant: "text-boost ring-boost/30",
  withdraw: "text-muted-foreground ring-border",
};

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtCompact(Math.abs(n))}`;

export function Balances({ data }: { data: TrackerData }) {
  const { sPendle, vePendle, loyalty, combined, pendleUsd, migration, flows, moves } = data;
  const f = flows.totals;
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
        methodId="method-balances"
        lede={
          <>
            Pendle&apos;s staking hub reports one &ldquo;total staked&rdquo; figure,{" "}
            <span className="tabular text-foreground">{fmtInt(total)}</span>{" "}
            <span className="tabular text-foreground/70">({usdOf(total, pendleUsd)})</span>.
            Onchain it is two balances: liquid sPENDLE, and PENDLE still in the old vePENDLE lock
            contract.
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <CardContent className="flex flex-col gap-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow
                className="text-spendle"
                tip="totalSupply() of the staking contract. Every sPENDLE earns rewards, claimed or not, so distributed but unclaimed rewards are part of this figure."
              >
                sPENDLE staked
              </Eyebrow>
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
                All sPENDLE in existence; each is backed by one PENDLE.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Unclaimed rewards"
                value={fmtCompact(sPendle.unclaimedInDistributor)}
                usd={usdOf(sPendle.unclaimedInDistributor, pendleUsd)}
                sub="keeps earning for its owners; included in the supply above"
              />
              <Stat
                label="In cooldown"
                value={fmtCompact(sPendle.cooldownQueue)}
                unit="PENDLE"
                usd={usdOf(sPendle.cooldownQueue, pendleUsd)}
                sub={`sPENDLE already burned; PENDLE withdrawable ${sPendle.cooldownDays} days after unstaking`}
                tip={`Unstaking burns the sPENDLE at once. The PENDLE is withdrawable after ${sPendle.cooldownDays} days, or immediately for a ${sPendle.instantFeePct}% fee.`}
              />
              <Stat
                label="PENDLE in contract"
                value={fmtCompact(sPendle.pendleHeld)}
                usd={usdOf(sPendle.pendleHeld, pendleUsd)}
                sub="sPENDLE supply + cooldown queue"
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
                PENDLE in the old vePENDLE lock contract, lock running or ended
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Under active lock"
                value={fmtCompact(vePendle.activeLocked)}
                usd={usdOf(vePendle.activeLocked, pendleUsd)}
                sub={`last unlock ${fmtDate(vePendle.lastLiveExpiry)}${vePendle.lastLiveExpiry > loyalty.expiresAt ? ", after the boost ends" : ""}`}
                tip={`Read from the vePENDLE contract's weekly unlock schedule.${vePendle.lastLiveExpiry > loyalty.expiresAt ? " The last unlock is after the boost ends because one lock was extended after the snapshot; its boost terms stay fixed." : ""}`}
              />
              <Stat
                label="Expired, unwithdrawn"
                value={fmtCompact(vePendle.expiredUnwithdrawn)}
                usd={usdOf(vePendle.expiredUnwithdrawn, pendleUsd)}
                sub="lock ended, PENDLE not withdrawn yet"
              />
              <Stat
                label="vePENDLE balance"
                value={fmtCompact(vePendle.veBalance)}
                sub="time-decayed voting weight, not a PENDLE quantity"
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
              sub={`${fmtCompact(vePendle.snapshotLocked)} locked snapshot PENDLE × ${fmtMult(loyalty.avgMultiplier)} average multiplier`}
              tip="The loyalty boost. Each snapshot lock counts 1 + 3 × remaining ÷ 2 years: 4× for a full two-year lock, 2.5× at one year, 1× at unlock. Summed over all snapshot locks; locks changed after the snapshot do not count."
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Boost premium"
              value={fmtCompact(loyalty.premium)}
              size="lg"
              sub="virtual sPENDLE above 1×; the part that dilutes stakers"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Reward-eligible total"
              value={fmtCompact(combined.rewardEligible)}
              size="lg"
              sub="all sPENDLE + virtual sPENDLE; what each distribution is split over"
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Boost ends"
              value={fmtDate(loyalty.expiresAt)}
              size="lg"
              sub={`${fmtDays(loyalty.maxRemainingDays)} left, fixed by the snapshot schedule`}
              tip={`Between weekly unlock batches the virtual balance falls about ${fmtCompact(loyalty.decayPerDay)} per day. After this date the premium is zero.`}
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
                There is no conversion: an expired lock is withdrawn, and staking the PENDLE is a
                separate step. Bars: weekly withdrawals, split by whether the same wallet staked within
                30 days.
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
              sub={`${fmtCompact(m.restaked)} PENDLE by ${fmtInt(m.restakers)} wallets, within 30 days of withdrawing`}
            />
            <Stat
              label="sPENDLE supply since the snapshot"
              value={`${fmtCompact(first.sPendle)} → ${fmtCompact(last.sPendle)}`}
              tone="spendle"
              sub={`+${fmtCompact(last.sPendle - first.sPendle)}; restaked locks are ${fmtPct(m.restaked / (last.sPendle - first.sPendle), 0)} of it, the rest new staking and rewards`}
            />
          </div>
          <MigrationChart weeks={migration.weeks} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1.5">
              <Eyebrow tip="From the staking contract's Staked, CooldownInitiated, CooldownCanceled and Unstaked events since the snapshot. The buyback contract's own stakes (reward distributions) are left out, so this is holder behaviour only.">
                Staking flows
              </Eyebrow>
              <p className="max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
                Weekly PENDLE staked by holders against sPENDLE sent to the {sPendle.cooldownDays}-day cooldown or
                unstaked instantly for the {sPendle.instantFeePct}% fee. The queue is PENDLE that becomes withdrawable
                within two weeks.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Swatch tone="spendle" /> staked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch tone="vependle" /> to cooldown
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch tone="boost" /> instant, fee paid
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LineSwatch tone="foreground" /> cooldown queue
              </span>
            </div>
          </div>
          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Net holder flow, 7 days"
              value={signed(flows.net7d)}
              unit="PENDLE"
              tone={flows.net7d >= 0 ? "spendle" : "boost"}
              sub={`${signed(flows.net30d)} over 30 days; stakes minus cooldowns and instant unstakes, cancellations added back`}
            />
            <Stat
              label="Cooldown queue"
              value={fmtCompact(flows.queue.now)}
              unit="PENDLE"
              tone="vependle"
              sub={`${signed(flows.queue.now - flows.queue.weekAgo)} vs a week ago; withdrawable within ${sPendle.cooldownDays} days`}
            />
            <Stat
              label="Unstaked instantly"
              value={fmtCompact(f.instant)}
              unit="PENDLE"
              sub={`${fmtInt(f.instantCount)} unstakes since the snapshot, ${fmtPct(f.instant / (f.instant + f.toCooldown), 0)} of all unstaking by amount`}
              tip="Holders who paid the fee rather than wait. The rest went through the cooldown."
            />
            <Stat
              label="Fees paid to skip the queue"
              value={fmtCompact(f.instantFee)}
              unit="PENDLE"
              tone="boost"
              usd={usdOf(f.instantFee, pendleUsd)}
              sub="sent to the Pendle treasury in the same transaction"
              tip="The PENDLE transfer paired with every Unstaked event with a non-zero fee goes to Pendle's treasury multisig, 0x8270…b592."
            />
          </div>
          <FlowsChart weeks={flows.weeks} />
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Eyebrow tip="The largest single stakes, cooldown starts, instant unstakes, and expired-lock withdrawals in the last 30 days, by wallet.">
              Largest moves, 30 days
            </Eyebrow>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {moves.map((m) => (
                <li
                  key={m.txHash + m.kind}
                  className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] ${MOVE_TONE[m.kind]}`}>
                      {MOVE_LABEL[m.kind]}
                    </Badge>
                    <span className="tabular text-[11px] text-muted-foreground">{fmtDate(m.timestamp, { year: undefined })}</span>
                  </div>
                  <div className="tabular text-lg leading-none text-foreground">
                    {fmtCompact(m.amount)} <span className="text-[11px] text-muted-foreground">PENDLE</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <AddressLink address={m.wallet} />
                    <TxLink hash={m.txHash} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
