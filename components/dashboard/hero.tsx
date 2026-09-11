import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtInt, fmtPct, fmtUsdCompact } from "@/lib/format";
import { ETHERSCAN } from "@/lib/pendle/config";

const DAY = 86_400;

/**
 * Opens the page with the thing that defines sPENDLE: the fortnightly distribution. Every payout
 * so far as a bar on a time axis, the PENDLE waiting in the buyback contract as the next one.
 */
export function Hero({ data }: { data: TrackerData }) {
  const { distributions, yield: y, block } = data;
  const first = distributions[0];
  const latest = distributions[distributions.length - 1];
  const start = first.timestamp - 10 * DAY;
  const end = Math.max(block.timestamp, y.nextDistributionEta) + 12 * DAY;
  const span = end - start;
  const x = (t: number) => ((t - start) / span) * 100;
  const peak = Math.max(...distributions.map((d) => d.amount), y.pendingBuyback);
  const h = (v: number) => Math.max(2, (v / peak) * 100);
  const pendingAt = Math.max(y.nextDistributionEta, block.timestamp);
  const due = y.nextDistributionEta <= block.timestamp ? "due any time" : `due ${fmtDate(y.nextDistributionEta)}`;

  const months: { t: number; label: string }[] = [];
  for (let d = new Date(start * 1000); d.getTime() / 1000 < end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    if (m > start && m < end) months.push({ t: m, label: fmtDate(m, { day: undefined, year: undefined }) });
  }

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
        <div className="relative h-36 sm:h-44">
          <div className="absolute inset-x-0 bottom-0 border-b border-foreground/25" />
          {distributions.map((d, i) => (
            <a
              key={d.txHash}
              href={`${ETHERSCAN}/tx/${d.txHash}`}
              target="_blank"
              rel="noreferrer"
              title={`${fmtDate(d.timestamp)}: ${fmtInt(d.amount)} sPENDLE, plain APR ${fmtPct(d.aprPlain)}`}
              className="group absolute bottom-0 w-[1.6%] min-w-[6px] -translate-x-1/2"
              style={{ left: `${x(d.timestamp)}%`, height: `${h(d.amount)}%` }}
            >
              <span
                className="ruler-bar block h-full w-full rounded-t-[2px] bg-spendle transition-colors group-hover:bg-foreground"
                style={{ "--i": i } as React.CSSProperties}
              />
              {d === latest && (
                <span className="tabular absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-xs text-spendle sm:block">
                  {fmtCompact(d.amount)}
                </span>
              )}
            </a>
          ))}
          <div
            title={`${fmtCompact(y.pendingBuyback)} PENDLE bought back so far, not yet distributed`}
            className="absolute bottom-0 w-[1.6%] min-w-[6px] -translate-x-1/2"
            style={{ left: `${x(pendingAt)}%`, height: `${h(y.pendingBuyback)}%` }}
          >
            <span
              className="ruler-bar block h-full w-full rounded-t-[2px] border border-dashed border-spendle/70"
              style={{ "--i": distributions.length } as React.CSSProperties}
            />
            <span className="tabular absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground">
              {fmtCompact(y.pendingBuyback)}
            </span>
          </div>
        </div>
        <div className="relative h-5">
          {months.map((m) => (
            <span
              key={m.t}
              className="absolute top-0 -translate-x-1/2 text-[11px] text-muted-foreground"
              style={{ left: `${x(m.t)}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <figcaption className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>Bar height is sPENDLE paid in that distribution; each bar links to its transaction.</span>
          <span>The dashed bar is PENDLE bought back since {fmtDate(latest.timestamp)}, not yet paid out.</span>
        </figcaption>
      </figure>

      <dl className="grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
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
