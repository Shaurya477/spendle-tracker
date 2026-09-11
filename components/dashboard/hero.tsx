import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtInt, fmtPct, fmtUsdCompact } from "@/lib/format";
import { Ruler } from "./ruler";

/**
 * Opens the page with the thing that defines sPENDLE: the fortnightly distribution. The latest
 * payouts as bars on a time axis, the PENDLE waiting in the buyback contract as the next one.
 */
export function Hero({ data }: { data: TrackerData }) {
  const { distributions, yield: y, block } = data;
  const first = distributions[0];
  const latest = distributions[distributions.length - 1];
  const pendingAt = Math.max(y.nextDistributionEta, block.timestamp);
  const due = y.nextDistributionEta <= block.timestamp ? "due any time" : `due ${fmtDate(y.nextDistributionEta)}`;

  return (
    <section aria-labelledby="hero-title" className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h1 id="hero-title" className="font-display max-w-[22ch] text-[2.6rem] leading-[0.95] sm:text-[3.6rem] lg:text-[4.4rem]">
          <span className="text-spendle">{fmtInt(y.totalDistributed)} sPENDLE</span> paid to stakers since{" "}
          {fmtDate(first.timestamp, { day: undefined })}.
        </h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
          Bought on the market with {fmtUsdCompact(y.totalBuybackUsd)} of protocol fees across{" "}
          {distributions.length} distributions. {fmtCompact(y.pendingBuyback)} PENDLE is already waiting
          in the buyback contract for the next one, {due}.
        </p>
      </div>

      <figure className="flex flex-col gap-3">
        <Ruler bars={distributions} pending={y.pendingBuyback} pendingAt={pendingAt} />
        <figcaption className="max-w-[80ch] text-xs leading-relaxed text-muted-foreground">
          The five most recent distributions, scaled to the sPENDLE each paid out; drag the strip or use
          the arrows to move through earlier ones. Hover a bar for the detail; click to open the
          transaction on Etherscan. The dashed bar is PENDLE bought back since {fmtDate(latest.timestamp)}{" "}
          and not yet distributed.
        </figcaption>
      </figure>

      <dl className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">Plain sPENDLE APR, latest epoch</dt>
          <dd className="font-figure text-3xl text-spendle sm:text-4xl">{fmtPct(y.latest.aprPlain)}</dd>
          <dd className="text-xs text-muted-foreground">
            {fmtPct(y.trailing.aprPlain)} trailing mean over {y.trailing.epochs} epochs, in PENDLE terms
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">Boosted APR, average locker</dt>
          <dd className="font-figure text-3xl text-vependle sm:text-4xl">{fmtPct(y.latest.aprBoostedAvg)}</dd>
          <dd className="text-xs text-muted-foreground">
            plain × {y.latest.avgMultiplier.toFixed(2)}× average multiplier at the latest distribution
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">Same payout with no boost</dt>
          <dd className="font-figure text-3xl sm:text-4xl">{fmtPct(y.aprSolo)}</dd>
          <dd className="text-xs text-muted-foreground">
            latest distribution over sPENDLE alone; the boost ends {fmtDate(data.loyalty.expiresAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
