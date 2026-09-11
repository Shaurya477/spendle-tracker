import type { TrackerData } from "@/lib/pendle/tracker";
import type { FeeEpoch } from "@/lib/pendle/revenue";
import { EPOCH_SECONDS } from "@/lib/pendle/config";
import { fmtCompact, fmtDate, fmtInt, fmtPct, fmtUsd, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ExpandableTable } from "./expandable-table";
import { AccrualChart, EpochFeeChart } from "./charts";
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
        index="04"
        title="Fees, revenue, and incentives"
        lede={
          <>
            Pendle V2 takes 5% of YT yield and points plus a fee on PT/YT swaps; LPs keep 20% of the
            swap fees. Policy sends up to 80% of the rest to PENDLE buybacks paid to stakers as
            sPENDLE, 10% to treasury, 10% to operations.
          </>
        }
      />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-x-6">
        <dt className="text-xs font-medium text-spendle">Funded</dt>
        <dd>USDT sent to the buyback contract for the epoch.</dd>
        <dt className="text-xs font-medium text-spendle">Bought</dt>
        <dd>PENDLE that USDT bought, paid to stakers 14 to 28 days after the epoch starts.</dd>
        <dt className="text-xs font-medium text-muted-foreground">80% share</dt>
        <dd>0.8 × DefiLlama Revenue. Policy, not a flow: the gap to Funded is in-kind airdrops and lag.</dd>
        <dt className="text-xs font-medium text-muted-foreground">Source</dt>
        <dd>DefiLlama, Pendle V2 only, all chains, since 29 Jan 2026. A fee counts on the day it reaches Pendle&apos;s treasury, so single epochs are lumpy.</dd>
      </dl>

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
              sub={`${fmtPct(share(e.yt, gross), 1)} of gross; Revenue − 80% of swap: YT, limit-order and points fees, airdrop tokens at the treasury`}
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
            />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent>
            <Stat
              label="Protocol take"
              value={fmtUsd(e.revenue)}
              size="lg"
              sub={`${fmtUsd(e.buyback)} 80% share; funded ${fmtUsd(e.buybackFunded)}${e.buybackWindowClosed ? "" : " so far"}; ${e.bought ? `bought ${fmtInt(e.bought.pendle)} PENDLE for ${fmtUsd(e.bought.usd)}` : "buyback executing, not yet distributed"}; ${fmtUsd(e.treasury)} treasury, ${fmtUsd(e.ops)} ops`}
            />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent>
            <Stat
              label="Gross fees"
              value={fmtUsd(gross)}
              size="lg"
              sub={`non-swap + swap; LPs keep ${fmtPct(share(e.lp, gross), 1)} of it`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Gross fees, latest complete epoch</Eyebrow>
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
              <Eyebrow>Policy split 80 / 10 / 10</Eyebrow>
              <span className="text-[11px] text-muted-foreground">100% = DefiLlama Revenue</span>
            </div>
            <Split
              parts={[
                { label: "80% share", value: e.buyback, color: YT },
                { label: "Treasury", value: e.treasury, color: TREASURY },
                { label: "Operations", value: e.ops, color: OPS },
              ]}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Funded{e.buybackWindowClosed ? "" : " so far"}: {fmtUsd(e.buybackFunded)},{" "}
              {fmtPct(share(e.buybackFunded, e.buyback), 0)} of the 80% share.
              {e.airdropUsd !== null ? ` In-kind airdrops this epoch: ${fmtUsd(e.airdropUsd)}.` : ""}{" "}
              {e.bought
                ? `Bought ${fmtInt(e.bought.pendle)} PENDLE for ${fmtUsd(e.bought.usd)}, paid to stakers on ${fmtDate(e.bought.distributedAt)}.`
                : "Buyback not yet distributed."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Non-swap vs swap by epoch</Eyebrow>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-spendle" /> YT and other
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-vependle" /> Swap
                </span>
              </div>
            </div>
            <EpochFeeChart epochs={r.epochs} />
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Cumulative fees vs emissions</Eyebrow>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-spendle" /> 80% share
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-px w-3 bg-foreground" /> Funded
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm" style={{ background: TREASURY }} /> Treasury
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-boost" /> Ops
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm" style={{ background: LP }} /> LP fees
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-px w-3 bg-boost" /> LP emissions
                </span>
              </div>
            </div>
            <AccrualChart points={r.cumulative} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Stacked USD is the 80/10/10 policy split of DefiLlama Revenue plus LP swap fees,
              cumulative from 29 Jan 2026. The solid line is USDT actually received by the buyback
              contract, each transfer attributed to the fee epoch whose end is nearest. The dashed
              line (right axis) is LP emissions: PENDLE paid to Ethereum markets from the gauge
              controller over the same period, new supply for LPs to hold or sell. It is the
              Performance stream only; limit-order and co-incentive PENDLE is paid elsewhere and is
              not counted. The gauge pays from PENDLE it already held, so PENDLE total supply
              is flat; these are emissions into circulation, not minting. Other chains&apos; AIM is in
              the AIM card.
            </p>
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
                sub={`bought with USDT and paid to stakers as sPENDLE over ${r.epochs.filter((x) => x.bought).length} distributions; USD is the USDT spent`}
              />
              <Stat
                label="Buyback funded"
                value={fmtUsd(r.totals.buybackFunded)}
                sub={`USDT received by the buyback contract since 29 Jan 2026; the unspent part is the open window`}
              />
              <Stat
                label="80% policy share"
                value={fmtUsd(r.totals.buyback)}
                sub={`0.8 × DefiLlama Revenue; funded is ${fmtPct(share(r.totals.buybackFunded, r.totals.buyback), 0)} of it, the gap is airdrops and lag`}
              />
              <Stat
                label="In-kind airdrops"
                value={fmtUsd(r.airdrops.usd)}
                tone="vependle"
                sub={`passed to stakers as-is, not bought back; Pendle's API, ${r.airdrops.epochs} epochs since ${fmtDate(r.airdrops.from)}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4 sm:grid-cols-4">
              <Stat label="Gross fees" value={fmtUsd(r.totals.yt + r.totals.swap)} sub={`non-swap ${fmtUsd(r.totals.yt)}, swap ${fmtUsd(r.totals.swap)}`} />
              <Stat label="Treasury" value={fmtUsd(r.totals.treasury)} sub="10% policy share of Revenue" />
              <Stat label="Operations" value={fmtUsd(r.totals.ops)} sub="10% policy share of Revenue" />
              <Stat label="LP swap fees" value={fmtUsd(r.totals.lp)} sub="20% of gross swap" />
            </div>
            <div className="grid gap-6 border-t border-border pt-4 sm:grid-cols-2">
              <Stat
                label="Emissions to LPs"
                value={fmtInt(r.totals.emittedPendle)}
                unit="PENDLE"
                usd={usdOf(r.totals.emittedPendle, pendleUsd)}
                tone="boost"
                sub={`PENDLE paid to Ethereum LPs from the gauge controller since 29 Jan 2026, Performance stream only; ${fmtInt(r.gaugePendle)} PENDLE left in it; USD at the live quote`}
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
              sub="PENDLE per week as reported by Pendle's incentives API, all chains; not all of it goes to LPs"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {fmtCompact(r.aim.tvl + r.aim.fee)} PENDLE is the Performance stream (TVL + fee), paid to
              pools through the gauge controllers; {fmtCompact(r.aim.limitOrder)} is the limit-order
              stream, paid to order makers; {fmtCompact(r.aim.discretionary + r.aim.cobribing)} is
              discretionary and co-incentives.
            </p>
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
            <Eyebrow>Every fee epoch</Eyebrow>
            <span className="text-[11px] text-muted-foreground">
              USD from DefiLlama and the buyback contract&apos;s USDT transfers; since 29 Jan 2026
            </span>
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
          <p className="px-4 pt-3 text-xs leading-relaxed text-muted-foreground">
            Funded is USDT received by the buyback contract, attributed to the fee epoch whose end is
            nearest (within seven days either side)
            {e.buybackWindowClosed
              ? "."
              : `; the ${fmtDate(e.start)} epoch can still receive funding until ${fmtDate(ends(e) + EPOCH_SECONDS / 2)}.`}{" "}
            Bought is the PENDLE paid to stakers in the distribution that lands 14 to 28 days after the epoch
            start; the USDT spent per distribution is in the ledger. Treasury and ops are the 10/10 policy split of
            DefiLlama Revenue. DefiLlama books fees on the day tokens
            reach the treasury, so a row is not Pendle&apos;s epoch accounting and its last day can
            arrive a day late; the 27 Jan 2026 row starts at the 29 Jan snapshot. Emissions are PENDLE paid
            to Ethereum LPs from the gauge controller, with epoch boundaries approximated from block times.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
