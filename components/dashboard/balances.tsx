import type { TrackerData } from "@/lib/pendle/tracker";
import type { Move } from "@/lib/pendle/chain";
import { fmtCompact, fmtDate, fmtDays, fmtInt, fmtMult, fmtPct, usdOf } from "@/lib/format";
import { FLOWS_SERIES, MIGRATION_SERIES } from "@/lib/chart-series";
import { FlowsChart, MigrationChart } from "./charts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddressLink, Eyebrow, SectionHeading, Stat, Swatch, TxLink } from "./primitives";
import { SeriesLegend, SeriesProvider } from "./series";

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
                All sPENDLE in existence; each is backed by one PENDLE.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Unclaimed rewards"
                value={fmtCompact(sPendle.unclaimedInDistributor)}
                usd={usdOf(sPendle.unclaimedInDistributor, pendleUsd)}
                tip="The rewards distributor's sPENDLE balance: distributions paid out but not yet claimed. It is minted sPENDLE, so it sits inside the supply figure and keeps earning for whoever it belongs to."
              />
              <Stat
                label="In cooldown"
                value={fmtCompact(sPendle.cooldownQueue)}
                unit="PENDLE"
                usd={usdOf(sPendle.cooldownQueue, pendleUsd)}
                sub={`withdrawable ${sPendle.cooldownDays} days after unstaking`}
                tip={`Unstaking burns the sPENDLE at once; the PENDLE waits here and earns nothing. It is withdrawable after ${sPendle.cooldownDays} days, or immediately for a ${sPendle.instantFeePct}% fee.`}
              />
              <Stat
                label="PENDLE in contract"
                value={fmtCompact(sPendle.pendleHeld)}
                usd={usdOf(sPendle.pendleHeld, pendleUsd)}
                sub="sPENDLE supply + cooldown"
                tip="PENDLE balanceOf the staking contract. Every sPENDLE is backed by one PENDLE here; the excess over sPENDLE supply is the cooldown queue."
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
                PENDLE in the old lock contract; no new locks, only withdrawals.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <Stat
                label="Under active lock"
                value={fmtCompact(vePendle.activeLocked)}
                usd={usdOf(vePendle.activeLocked, pendleUsd)}
                sub={`last unlock ${fmtDate(vePendle.lastLiveExpiry)}${vePendle.lastLiveExpiry > loyalty.expiresAt ? ", after the boost ends" : ""}`}
                tip={`PENDLE whose lock has not expired, from the vePENDLE contract's weekly unlock schedule at the latest block.${vePendle.lastLiveExpiry > loyalty.expiresAt ? " The last unlock is after the boost ends because one lock was extended after the snapshot; its boost terms stay fixed." : ""}`}
              />
              <Stat
                label="Expired, unwithdrawn"
                value={fmtCompact(vePendle.expiredUnwithdrawn)}
                usd={usdOf(vePendle.expiredUnwithdrawn, pendleUsd)}
                tip="Lock ended, PENDLE not withdrawn yet: PENDLE in the contract minus PENDLE under a live lock. Its owners can withdraw at any time; it earns nothing and carries no boost."
              />
              <Stat
                label="vePENDLE balance"
                value={fmtCompact(vePendle.veBalance)}
                tip="Voting weight, not a PENDLE quantity: Σ amount × remaining time ÷ 2 years over live locks. It falls every second and reaches zero at each lock's expiry. Virtual sPENDLE is locked PENDLE + 3 × this figure, on the snapshot schedule."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow tip="The staking hub's total staked as the three onchain balances above: sPENDLE supply, PENDLE under a live lock, and PENDLE whose lock ended but was not withdrawn.">
            How total staked splits
          </Eyebrow>
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
              sub={`${fmtCompact(vePendle.snapshotLocked)} snapshot-locked × ${fmtMult(loyalty.avgMultiplier)}`}
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
              tip="Virtual sPENDLE above a 1× count of the locked PENDLE behind it (3 × the snapshot vePENDLE balance). Only this excess takes reward share from everyone else; it falls to zero as the snapshot locks run down."
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Reward-eligible total"
              value={fmtCompact(combined.rewardEligible)}
              size="lg"
              tip="All sPENDLE (wallet-held and unclaimed) + virtual sPENDLE: the denominator of every distribution. A staker's share is their sPENDLE ÷ this figure."
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Boost ends"
              value={fmtDate(loyalty.expiresAt)}
              size="lg"
              sub={`${fmtDays(loyalty.maxRemainingDays)} left`}
              tip={`The last expiry on the snapshot lock schedule, fixed at the 29 Jan 2026 snapshot. Between weekly unlock batches the virtual balance falls about ${fmtCompact(loyalty.decayPerDay)} per day; after this date the premium is zero.`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <SeriesProvider series={MIGRATION_SERIES}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1.5">
              <Eyebrow tip="There is no conversion: an expired lock is withdrawn, and staking the PENDLE is a separate step. Bars: weekly withdrawals, split by whether the same wallet staked within 30 days. Lines, right axis: PENDLE still in vePENDLE and sPENDLE supply. Legend items switch their series on and off; the last one shown stays on.">
                From vePENDLE to sPENDLE
              </Eyebrow>
            </div>
            <SeriesLegend />
          </div>
          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
            <Stat
              label="Withdrawn since the snapshot"
              value={fmtCompact(m.withdrawn)}
              unit="PENDLE"
              sub={`by ${fmtInt(m.wallets)} wallets; vePENDLE ${fmtCompact(first.vePendle)} → ${fmtCompact(last.vePendle)}`}
              tip="Every PENDLE transfer out of the vePENDLE contract since the 29 Jan 2026 snapshot. withdraw() on an expired lock is the only way out, so each transfer is one lock closing."
            />
            <Stat
              label="Restaked as sPENDLE"
              value={fmtPct(restakeRate, 0)}
              tone="spendle"
              sub={`${fmtCompact(m.restaked)} PENDLE by ${fmtInt(m.restakers)} wallets`}
              tip="A withdrawal counts as restaked to the extent the same wallet minted sPENDLE within 30 days after it. The rate is over withdrawals whose 30-day window has closed, so the latest weeks are not in it yet. A different wallet restaking is not matched."
            />
            <Stat
              label="sPENDLE supply since the snapshot"
              value={`${fmtCompact(first.sPendle)} → ${fmtCompact(last.sPendle)}`}
              tone="spendle"
              sub={`+${fmtCompact(last.sPendle - first.sPendle)}; ${fmtPct(m.restaked / (last.sPendle - first.sPendle), 0)} of it restaked locks`}
              tip="sPENDLE supply at the snapshot week and now. Growth comes from three places: PENDLE restaked out of expired locks, fresh staking by holders, and the sPENDLE each distribution mints for stakers."
            />
          </div>
          <MigrationChart weeks={migration.weeks} />
          </SeriesProvider>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <SeriesProvider series={FLOWS_SERIES}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1.5">
              <Eyebrow
                tip={`Net holder flow each week: PENDLE staked by holders minus sPENDLE sent to the ${sPendle.cooldownDays}-day cooldown or unstaked instantly for the ${sPendle.instantFeePct}% fee, cancelled cooldowns added back. The bars are those parts; the queue, right axis, is PENDLE that becomes withdrawable within two weeks. From the staking contract's events since the snapshot, the buyback contract's own stakes left out. Legend items switch their series on and off; the last one shown stays on.`}
              >
                Staking flows
              </Eyebrow>
            </div>
            <SeriesLegend />
          </div>
          <div className="grid gap-4 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Net holder flow, 7 days"
              value={signed(flows.net7d)}
              unit="PENDLE"
              tone={flows.net7d >= 0 ? "spendle" : "boost"}
              sub={`${signed(flows.net30d)} over 30 days`}
              tip="Staked − (sent to cooldown + unstaked instantly − cooldowns cancelled) over the last 7 days. The buyback contract's own stakes are excluded, so this is holders adding or removing PENDLE, not rewards. Green when positive, amber when negative."
            />
            <Stat
              label="Cooldown queue"
              value={fmtCompact(flows.queue.now)}
              unit="PENDLE"
              tone="vependle"
              sub={`${signed(flows.queue.now - flows.queue.weekAgo)} vs a week ago`}
              tip={`PENDLE whose sPENDLE was burned for cooldown and not yet withdrawn. It no longer earns, and all of it becomes withdrawable within ${sPendle.cooldownDays} days: unstaking that is already decided.`}
            />
            <Stat
              label="Unstaked instantly"
              value={fmtCompact(f.instant)}
              unit="PENDLE"
              sub={`${fmtInt(f.instantCount)} unstakes; ${fmtPct(f.instant / (f.instant + f.toCooldown), 0)} of all unstaking`}
              tip="sPENDLE unstaked for the fee rather than through the cooldown, since the snapshot, gross of the fee. The share is by amount against everything unstaked either way."
            />
            <Stat
              label="Fees paid to skip the queue"
              value={fmtCompact(f.instantFee)}
              unit="PENDLE"
              tone="boost"
              usd={usdOf(f.instantFee, pendleUsd)}
              tip="Fees on instant unstakes since the snapshot. The PENDLE transfer paired with every Unstaked event with a non-zero fee goes to Pendle's treasury multisig, 0x8270…b592, in the same transaction."
            />
          </div>
          <FlowsChart weeks={flows.weeks} />
          </SeriesProvider>
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
