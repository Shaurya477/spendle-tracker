import type { TrackerData } from "@/lib/pendle/tracker";
import type { FeeEpoch } from "@/lib/pendle/revenue";
import { EPOCH_SECONDS } from "@/lib/pendle/config";
import { fmtCompact, fmtDate, fmtInt, fmtPct, fmtUsd, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ExpandableTable } from "./expandable-table";
import { ACCRUAL_SERIES, EPOCH_FEE_SERIES } from "@/lib/chart-series";
import { AccrualChart, EpochFeeChart } from "./charts";
import { SeriesLegend, SeriesProvider } from "./series";
import { Eyebrow, SectionHeading, Stat } from "./primitives";

const YT = "var(--spendle)";
const SWAP = "var(--vependle)";
const TREASURY = "var(--chart-4)";
const OPS = "var(--boost)";
const LP = "var(--chart-lp)";

function share(part: number, whole: number) {
  return whole > 0 ? part / whole : 0;
}

function Split({
  parts,
  format = fmtUsd,
}: {
  parts: { label: string; value: number; color: string }[];
  format?: (n: number) => string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {parts.map((p) => (
          <div
            key={p.label}
            title={`${p.label} ${format(p.value)}`}
            style={{ width: `${share(p.value, total) * 100}%`, background: p.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {parts.map((p) => (
          <div key={p.label} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </div>
            <div className="tabular text-sm">
              {format(p.value)}{" "}
              <span className="text-muted-foreground">{fmtPct(share(p.value, total), 1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Revenue({ data }: { data: TrackerData }) {
  const { revenue: r, pendleUsd } = data;
  const e = r.latestComplete;
  const current = r.current;
  const gross = e.yt + e.swap;
  const ends = (epoch: FeeEpoch) => epoch.start + EPOCH_SECONDS;

  return (
    <section id="fees" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="05"
        title="Fees, revenue, and incentives"
        methodId="method-fees"
        lede={
          <>
            Pendle V2 takes 5% of YT yield and points plus a fee on PT/YT swaps; LPs keep 20% of swap
            fees. Of the rest, policy sends up to 80% to PENDLE buybacks for stakers, 10% to treasury,
            10% to operations.
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Eyebrow>Latest complete epoch</Eyebrow>
          <span className="tabular text-sm">
            {fmtDate(e.start)} → {fmtDate(ends(e))}
          </span>
        </div>
        <Badge variant="outline" className="text-[11px] text-boost ring-boost/30">
          {fmtDate(current.start)} epoch{current.complete ? " complete" : `, ${current.days} days in`}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="">
          <CardContent>
            <Stat
              label="YT and other fees"
              value={fmtUsd(e.yt)}
              tone="spendle"
              size="lg"
              sub={`${fmtPct(share(e.yt, gross), 1)} of gross`}
              tip="Everything booked at the treasury except swap fees: DefiLlama Revenue minus the protocol's 80% of swap fees, which is YT yield and points fees, limit-order fees, post-maturity yield, and airdrop tokens forwarded to the treasury."
            />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent>
            <Stat
              label="Swap fees"
              value={fmtUsd(e.swap)}
              tone="vependle"
              size="lg"
              sub={`${fmtPct(share(e.swap, gross), 1)} of gross: ${fmtUsd(e.lp)} to LPs, ${fmtUsd(e.swapToProtocol)} to protocol`}
              tip="Gross PT/YT swap fees, derived as DefiLlama's supply-side revenue ÷ 0.20, since LPs keep a fixed 20% of swap fees. The other 80% is the protocol's and is inside DefiLlama Revenue."
            />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent>
            <Stat
              label="Protocol take"
              value={fmtUsd(e.revenue)}
              size="lg"
              tip="DefiLlama's Revenue for Pendle V2 over the epoch: everything booked at Pendle's treasury, which is gross fees minus the LPs' 20% of swap fees. The base the 80 / 10 / 10 policy applies to, split in the card below."
            />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent>
            <Stat
              label="Gross fees"
              value={fmtUsd(gross)}
              size="lg"
              sub={`LPs keep ${fmtPct(share(e.lp, gross), 1)}`}
              tip="Everything users paid Pendle over the 14-day epoch, before the LP share: YT and other fees plus gross swap fees, from DefiLlama's daily Pendle V2 data across every chain. DefiLlama books a fee on the day tokens reach the treasury, so single epochs are lumpy and can run a day late. The figure the Valuation section annualises."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow tip="Where the epoch's gross fees went: non-swap fees all to the protocol, swap fees split 80% protocol and 20% LPs. The two protocol parts together are DefiLlama Revenue.">
                Gross fees, latest complete epoch
              </Eyebrow>
              <span className="text-[11px] text-muted-foreground">100% = non-swap + swap</span>
            </div>
            <Split
              parts={[
                { label: "YT and other → protocol", value: e.yt, color: YT },
                { label: "Swap → protocol", value: e.swapToProtocol, color: SWAP },
                { label: "Swap → LPs", value: e.lp, color: LP },
              ]}
            />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow tip="Pendle's stated split of Revenue: up to 80% to PENDLE buybacks for stakers, 10% to treasury, 10% to operations. The bar is that policy applied to the epoch's Revenue; the lines below it are what actually happened onchain for this epoch.">
                Policy split 80 / 10 / 10
              </Eyebrow>
              <span className="text-[11px] text-muted-foreground">100% = DefiLlama Revenue</span>
            </div>
            <Split
              parts={[
                { label: "80% share", value: e.buyback, color: YT },
                { label: "Treasury", value: e.treasury, color: TREASURY },
                { label: "Operations", value: e.ops, color: OPS },
              ]}
            />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs leading-relaxed text-muted-foreground">
              <dt className="font-medium text-spendle">Funded{e.buybackWindowClosed ? "" : " so far"}</dt>
              <dd className="tabular">
                {fmtUsd(e.buybackFunded)}, {fmtPct(share(e.buybackFunded, e.buyback), 0)} of the 80% share
              </dd>
              {e.airdropUsd !== null && (
                <>
                  <dt className="font-medium">In-kind airdrops</dt>
                  <dd className="tabular">{fmtUsd(e.airdropUsd)}</dd>
                </>
              )}
              <dt className="font-medium text-spendle">Bought</dt>
              <dd className="tabular">
                {e.bought
                  ? `${fmtInt(e.bought.pendle)} PENDLE for ${fmtUsd(e.bought.usd)}, paid to stakers ${fmtDate(e.bought.distributedAt)}`
                  : "not yet distributed"}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <SeriesProvider series={EPOCH_FEE_SERIES}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow tip="Gross fees per 14-day epoch, non-swap stacked on swap. Click a legend item to hide it; the last one shown stays on.">
                  Non-swap vs swap by epoch
                </Eyebrow>
                <SeriesLegend />
              </div>
              <EpochFeeChart epochs={r.epochs} />
            </SeriesProvider>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <SeriesProvider series={ACCRUAL_SERIES}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow tip="Stacked areas: the 80/10/10 policy split of DefiLlama Revenue plus LP swap fees, since 29 Jan 2026. Solid line: USDT the buyback contract received. Dashed line, right axis: PENDLE the Ethereum gauge controller paid to LPs out of PENDLE it already held (Performance stream only; limit-order and co-incentive PENDLE is paid elsewhere); supply is unchanged. Click a legend item to hide it; the last one shown stays on.">
                  Cumulative fees vs emissions
                </Eyebrow>
                <SeriesLegend />
              </div>
              <AccrualChart points={r.cumulative} />
            </SeriesProvider>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="">
          <CardContent className="flex flex-col gap-6">
            <Eyebrow>sPENDLE era, since 29 Jan 2026</Eyebrow>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat
                label="Bought back"
                value={fmtCompact(r.totals.boughtPendle)}
                unit="PENDLE"
                usd={fmtUsd(r.totals.boughtUsd)}
                tone="spendle"
                sub={`${r.epochs.filter((x) => x.bought).length} distributions`}
                tip="PENDLE the buyback contract received and staked for stakers, summed over every distribution since the snapshot; the USD is the USDT it spent on the swaps. The buyback that has actually happened, against the policy share beside it."
              />
              <Stat
                label="Buyback funded"
                value={fmtUsd(r.totals.buybackFunded)}
                tip="Every USDT transfer into the buyback contract since 29 Jan 2026. The part not yet spent is the current epoch's open funding window."
              />
              <Stat
                label="80% policy share"
                value={fmtUsd(r.totals.buyback)}
                sub={`funded is ${fmtPct(share(r.totals.buybackFunded, r.totals.buyback), 0)} of it`}
                tip="0.8 × DefiLlama Revenue since the snapshot: a policy figure, not a flow. The gap to Funded is in-kind airdrops passed to stakers as tokens, funding for the current epoch that has not arrived yet, and any shortfall."
              />
              <Stat
                label="In-kind airdrops"
                value={fmtUsd(r.airdrops.usd)}
                tone="vependle"
                sub={`${r.airdrops.epochs} epochs since ${fmtDate(r.airdrops.from)}`}
                tip="Per-epoch airdrop USD from Pendle's staking API. These sit inside DefiLlama Revenue but are forwarded to stakers as the airdropped tokens, never bought back."
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4 sm:grid-cols-4">
              <Stat
                label="Gross fees"
                value={fmtUsd(r.totals.yt + r.totals.swap)}
                sub={`non-swap ${fmtUsd(r.totals.yt)}, swap ${fmtUsd(r.totals.swap)}`}
                tip="All fees users paid Pendle V2 since the snapshot, before the LP share: DefiLlama's daily fees summed across every chain."
              />
              <Stat
                label="Treasury"
                value={fmtUsd(r.totals.treasury)}
                tip="0.1 × DefiLlama Revenue since the snapshot. A policy figure: the treasury's actual receipts are not read from the chain here."
              />
              <Stat
                label="Operations"
                value={fmtUsd(r.totals.ops)}
                tip="0.1 × DefiLlama Revenue since the snapshot. A policy figure, the same as Treasury."
              />
              <Stat
                label="LP swap fees"
                value={fmtUsd(r.totals.lp)}
                tip="The 20% of gross swap fees that stays with liquidity providers and never reaches the protocol: DefiLlama's supply-side revenue since the snapshot."
              />
            </div>
            <div className="grid gap-6 border-t border-border pt-4 sm:grid-cols-2">
              <Stat
                label="Emissions to LPs"
                value={fmtInt(r.totals.emittedPendle)}
                unit="PENDLE"
                usd={usdOf(r.totals.emittedPendle, pendleUsd)}
                tone="boost"
                sub={`${fmtInt(r.gaugePendle)} PENDLE left in the gauge controller`}
                tip="PENDLE paid to Ethereum LPs from the gauge controller since 29 Jan 2026: start balance + top-ups − end balance. Performance stream only; limit-order and co-incentive PENDLE is paid elsewhere. USD at the live quote."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-boost">Current AIM assignment</Eyebrow>
              <span className="text-[11px] text-muted-foreground">{r.aim.markets} markets</span>
            </div>
            <Stat
              label="Assigned by AIM"
              value={fmtCompact(r.aim.pendle)}
              unit="PENDLE"
              usd={usdOf(r.aim.pendle, pendleUsd)}
              tone="boost"
              size="lg"
              sub="per week, all chains"
              tip="This week's assignment by Pendle's Adaptive Incentive Mechanism, from its incentives API across every chain; an assignment, not a payout yet. TVL and fee streams (the Performance stream) go to pools through the gauge controllers; limit-order PENDLE goes to order makers; the rest is discretionary and co-incentives."
            />
            <Split
              format={(n) => `${fmtCompact(n)} PENDLE`}
              parts={[
                { label: "TVL → pools", value: r.aim.tvl, color: YT },
                { label: "Fee → pools", value: r.aim.fee, color: SWAP },
                { label: "Limit order → makers", value: r.aim.limitOrder, color: TREASURY },
                { label: "Discretionary", value: r.aim.discretionary, color: OPS },
                { label: "Co-incentives", value: r.aim.cobribing, color: LP },
              ].filter((p) => p.value > 0)}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
            <Eyebrow tip="One row per 14-day fee epoch since the snapshot, newest first; the grid is fixed by a known epoch start on 7 Apr 2026. Fee columns are DefiLlama's daily data summed over the epoch; Funded and Bought are read from the chain. Definitions are under Column notes below the table.">
              Every fee epoch
            </Eyebrow>
            <span className="text-[11px] text-muted-foreground">since 29 Jan 2026</span>
          </div>
          <ExpandableTable
            noun="epochs"
            initial={r.current.complete ? 3 : 4}
            head={
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-medium text-muted-foreground">Epoch</TableHead>
                <TableHead className="text-right text-xs font-medium text-spendle">YT + other</TableHead>
                <TableHead className="text-right text-xs font-medium text-vependle">Swap</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">LP</TableHead>
                <TableHead className="text-right text-xs font-medium text-spendle">Funded</TableHead>
                <TableHead className="text-right text-xs font-medium text-spendle">Bought</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Treasury</TableHead>
                <TableHead className="text-right text-xs font-medium text-boost">Ops</TableHead>
                <TableHead className="pr-4 text-right text-xs font-medium text-boost">Emissions</TableHead>
              </TableRow>
            }
            rows={[...r.epochs].reverse().map((row) => (
              <TableRow key={row.start} className="tabular text-xs">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <span>{fmtDate(row.start)}</span>
                      {!row.complete && (
                        <Badge variant="outline" className="text-[11px] text-boost ring-boost/30">
                          in progress
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-spendle">{fmtUsd(row.yt)}</TableCell>
                  <TableCell className="text-right text-vependle">{fmtUsd(row.swap)}</TableCell>
                  <TableCell className="text-right">{fmtUsd(row.lp)}</TableCell>
                  <TableCell className="text-right text-spendle">
                    {row.buybackFunded > 0 ? fmtUsd(row.buybackFunded) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-spendle">
                    {row.bought ? `${fmtInt(row.bought.pendle)} PENDLE` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{fmtUsd(row.treasury)}</TableCell>
                  <TableCell className="text-right text-boost">{fmtUsd(row.ops)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {row.emittedPendle > 0 ? fmtInt(row.emittedPendle) : "—"}
                  </TableCell>
                </TableRow>
            ))}
          />
          <details className="px-4 pt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none list-none underline decoration-border underline-offset-4 hover:text-foreground [&::-webkit-details-marker]:hidden">
              Column notes
            </summary>
            <p className="mt-2 leading-relaxed">
              Funded: USDT received by the buyback contract, attributed to the fee epoch whose end is
              nearest (within seven days either side)
              {e.buybackWindowClosed
                ? "."
                : `; the ${fmtDate(e.start)} epoch can still receive funding until ${fmtDate(ends(e) + EPOCH_SECONDS / 2)}.`}{" "}
              Bought: PENDLE paid to stakers in the distribution 14 to 28 days after the epoch start; USDT
              per distribution is in the ledger. Treasury and ops: the 10/10 policy split of DefiLlama
              Revenue, which books fees on the day tokens reach the treasury, so a row can run a day late
              and is not Pendle&apos;s own epoch accounting; the 27 Jan 2026 row starts at the 29 Jan
              snapshot. Emissions: PENDLE paid to Ethereum LPs from the gauge controller, epoch boundaries
              approximated from block times. USD from DefiLlama and the buyback contract&apos;s USDT
              transfers.
            </p>
          </details>
        </CardContent>
      </Card>
    </section>
  );
}
