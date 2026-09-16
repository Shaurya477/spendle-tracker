import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtMult, fmtPct } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { DECAY_SERIES, DILUTION_SERIES, UNLOCK_SERIES } from "@/lib/chart-series";
import { DecayChart, DilutionChart, UnlockCalendarChart } from "./charts";
import { AddressLink, Eyebrow, SectionHeading, Stat } from "./primitives";
import { SeriesLegend, SeriesProvider } from "./series";

export function Dilution({ data }: { data: TrackerData }) {
  const { dilution, loyalty, sPendle, vePendle, projection, unlocks, liveUnlocks, lockers, topLocks, yield: y } = data;
  const biggest = [...unlocks].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const remainingNow = unlocks.reduce((s, u) => s + u.amount, 0);
  const liveRemaining = liveUnlocks.reduce((s, u) => s + u.amount, 0);
  const oneYear = projection.find((p) => p.t >= data.block.timestamp + 365.25 * 86_400);
  const lastLive = liveUnlocks[liveUnlocks.length - 1];
  const lockerTotal = lockers.reduce((s, l) => s + l.amount, 0);
  // Live unlock weeks holding more than the snapshot schedule: locks extended or added since.
  const moved = liveUnlocks
    .map((l) => ({ expiry: l.expiry, amount: l.amount - (unlocks.find((u) => u.expiry === l.expiry)?.amount ?? 0) }))
    .filter((l) => l.amount > 100_000)
    .sort((a, b) => b.amount - a.amount);

  return (
    <section id="dilution" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="04"
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
              tip="Virtual sPENDLE ÷ reward-eligible total: the share of each distribution that goes to snapshot lockers, boost included. The staker share is sPENDLE supply ÷ the same total; the two add to 100%. Lockers' share falls every week as their multipliers decay."
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
              tip="The latest distribution amount ÷ (today's sPENDLE supply + the virtual sPENDLE the snapshot schedule implies one year from now) × 26.09. Only the boost decay moves; fees, buybacks and staking are held at today's levels, so this isolates what the fading boost alone does for plain stakers."
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
              tip="Virtual sPENDLE ÷ snapshot-locked PENDLE: the PENDLE-weighted mean of 1 + 3 × remaining ÷ 2 years across every snapshot lock. Each PENDLE locked has this many units of reward weight against a staker's one. It falls linearly between unlock batches and reaches 1× when the last snapshot lock expires."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <SeriesProvider series={DECAY_SERIES}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Eyebrow tip="The snapshot lock schedule replayed forward at daily resolution; the steps are weekly unlock batches. Locks changed after the snapshot do not affect the boost. Legend items switch their series on and off; the last one shown stays on.">
                  Projected virtual sPENDLE
                </Eyebrow>
                <SeriesLegend />
              </div>
              <DecayChart points={projection} sPendle={sPendle.eligible} expiresAt={loyalty.expiresAt} />
            </SeriesProvider>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <SeriesProvider series={DILUTION_SERIES}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Eyebrow tip="Flat: sPENDLE supply held at today's. Restaked: unlocking PENDLE staked as sPENDLE the day its lock expires. Plain APR, right axis: each distribution held at the latest amount. Legend items switch their series on and off; the last one shown stays on.">
                  Projected dilution &amp; plain APR
                </Eyebrow>
                <SeriesLegend />
              </div>
              <DilutionChart points={projection} />
            </SeriesProvider>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <SeriesProvider series={UNLOCK_SERIES}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Eyebrow tip="Live: the schedule the contract holds today. Snapshot: the vePENDLE unlock schedule as it stood at the 29 Jan snapshot, which fixes the boost. They differ where a lock was extended or added after the snapshot; the boost terms of such a lock stay as they were. Legend items switch their series on and off; the last one shown stays on.">
                  When locked PENDLE becomes liquid
                </Eyebrow>
                <SeriesLegend />
              </div>
              <UnlockCalendarChart snapshot={unlocks} live={liveUnlocks} now={data.block.timestamp} />
            </SeriesProvider>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {fmtCompact(liveRemaining)} PENDLE is under a live lock, last unlock {fmtDate(lastLive.expiry)}.
              {moved.length > 0
                ? ` Extended since the snapshot: ${moved
                    .slice(0, 2)
                    .map((m) => `${fmtCompact(m.amount)} now unlocks ${fmtDate(m.expiry)}`)
                    .join("; ")}; its boost terms did not change.`
                : " No lock has been extended since the snapshot."}
            </p>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <Eyebrow tip="Live vePENDLE positions, from every NewLockPosition event the contract has emitted with the largest re-read from positionData at the latest block. Penpie, Equilibria and Stake DAO are the liquid-locker protocols whose users hold a wrapped claim on the lock.">
              Largest lock positions
            </Eyebrow>
            <ul className="flex flex-col divide-y divide-border/60">
              {topLocks.map((l) => (
                <li key={l.user} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {l.label && <span className="text-foreground">{l.label}</span>}
                    <AddressLink address={l.user} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="tabular text-sm text-vependle">
                      {fmtCompact(l.amount)}{" "}
                      <span className="text-[10px] text-muted-foreground">{fmtPct(l.amount / liveRemaining, 1)}</span>
                    </span>
                    <span className="tabular text-[11px] text-muted-foreground">unlocks {fmtDate(l.expiry)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <Eyebrow tip="Penpie, Equilibria and Stake DAO lock PENDLE on behalf of their depositors and issue a liquid token against it. What they do at expiry decides a large share of how the migration to sPENDLE ends.">
              Liquid lockers
            </Eyebrow>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {fmtCompact(lockerTotal)} PENDLE, {fmtPct(lockerTotal / vePendle.activeLocked, 0)} of everything under an
              active lock, sits in three protocols&apos; positions.
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {lockers.map((l) => (
              <li key={l.address} className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-foreground">{l.label}</span>
                  <span className="tabular text-[11px] text-muted-foreground">{fmtPct(l.share, 1)}</span>
                </div>
                <span className="tabular text-lg leading-none text-vependle">{fmtCompact(l.amount)}</span>
                <span className="tabular text-[11px] text-muted-foreground">unlocks {fmtDate(l.expiry)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="">
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-2">
            <Eyebrow tip="Snapshot schedule: this is what the boost decays against, whatever happens to the live locks.">Largest unlock weeks, snapshot schedule</Eyebrow>
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
