import type { TrackerData } from "@/lib/pendle/tracker";
import type { FeeEpoch } from "@/lib/pendle/revenue";
import { EPOCH_SECONDS } from "@/lib/pendle/config";
import { fmtCompact, fmtDate, fmtInt, fmtPct, fmtUsd, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            <div className="tabular font-mono text-sm">
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
    <section className="flex flex-col gap-8">
      <SectionHeading
        index="04"
        title="Fees, revenue, and incentives"
        lede={
          <>
            Pendle V2 charges 5% of the yield and points accrued by YT, plus a fee on PT/YT swaps.
            LPs keep 20% of swap fees; the rest, with all YT fees, is protocol take, which policy
            splits up to 80% buybacks, 10% treasury, 10% operations. The buyback is the PENDLE bought
            with that USDT and paid to stakers as sPENDLE; it runs below the 80% figure because
            revenue also counts in-kind airdrops passed through as-is, and because fees are harvested
            every two weeks and bought over the following weeks. AIM incentives are paid in PENDLE that
            already exists; supply is flat, nothing is minted.
          </>
        }
      />

      <div className="rise rise-1 grid gap-4 rounded-xl border border-border/70 bg-background/40 p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Latest complete epoch</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {fmtDate(e.start)} → {fmtDate(ends(e))}. The epoch starting {fmtDate(current.start)}{" "}
            {current.complete ? "is complete." : `is in progress (${current.days} days in).`} DefiLlama
            books a fee on the day the tokens reach Pendle&apos;s treasury, so an epoch&apos;s USD is
            lumpy, is not Pendle&apos;s own epoch accounting, and its last day can arrive a day late.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Policy split vs funded</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            80% share, treasury, and operations are the 80/10/10 policy split of DefiLlama&apos;s
            Revenue, not observed flows; Pendle&apos;s wording is &ldquo;up to 80%&rdquo;. Funded is
            USDT sent to the buyback contract, attributed to the epoch whose end is nearest. Bought is
            the PENDLE that USDT purchased by hourly TWAP and the distribution paid to stakers 14 to
            28 days after the epoch start; a two to three week lag is normal.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Pendle V2 only</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Daily USD from DefiLlama&apos;s Pendle V2 label, summed across chains, from 29 Jan 2026;
            Boros and anything before 29 Jan are excluded. Two identities back out the split: LP fees
            = 20% of gross swap; DefiLlama&apos;s Revenue field = non-swap fees + 80% of swap.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rise rise-2 border-0 bg-card/80 ring-1 ring-spendle/20">
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
        <Card className="rise rise-3 border-0 bg-card/80 ring-1 ring-vependle/20">
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
        <Card className="rise rise-4 border-0 bg-card/80">
          <CardContent>
            <Stat
              label="Protocol take"
              value={fmtUsd(e.revenue)}
              size="lg"
              sub={`${fmtUsd(e.buyback)} 80% share; funded ${fmtUsd(e.buybackFunded)}${e.buybackWindowClosed ? "" : " so far"}; ${e.bought ? `bought ${fmtInt(e.bought.pendle)} PENDLE for ${fmtUsd(e.bought.usd)}` : "buyback executing, not yet distributed"}; ${fmtUsd(e.treasury)} treasury, ${fmtUsd(e.ops)} ops`}
            />
          </CardContent>
        </Card>
        <Card className="rise rise-5 border-0 bg-card/80">
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
        <Card className="rise rise-2 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Gross fees, latest complete epoch</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">100% = non-swap + swap</span>
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
        <Card className="rise rise-3 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Policy split 80 / 10 / 10</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">100% = DefiLlama Revenue</span>
            </div>
            <Split
              parts={[
                { label: "80% share", value: e.buyback, color: YT },
                { label: "Treasury", value: e.treasury, color: TREASURY },
                { label: "Operations", value: e.ops, color: OPS },
              ]}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Funded{e.buybackWindowClosed ? "" : " so far"}: {fmtUsd(e.buybackFunded)} USDT sent to the
              buyback contract for this epoch, {fmtPct(share(e.buybackFunded, e.buyback), 0)} of the 80%
              share. The 80% is policy, not an observed flow: Revenue includes in-kind airdrops that
              go to stakers as-is{e.airdropUsd !== null ? ` (${fmtUsd(e.airdropUsd)} this epoch per Pendle&apos;s API)` : ""}, and fees
              harvested at epoch end are bought over the following weeks.{" "}
              {e.bought
                ? `The buyback for this epoch bought ${fmtInt(e.bought.pendle)} PENDLE for ${fmtUsd(e.bought.usd)} and was paid to stakers on ${fmtDate(e.bought.distributedAt)}.`
                : "Its buyback has not been distributed yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rise rise-3 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Non-swap vs swap by epoch</Eyebrow>
              <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
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
        <Card className="rise rise-4 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Cumulative fees vs ETH gauge</Eyebrow>
              <div className="flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
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
                  <span className="inline-block h-px w-3 bg-boost" /> ETH gauge
                </span>
              </div>
            </div>
            <AccrualChart points={r.cumulative} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Stacked USD is the 80/10/10 policy split of DefiLlama Revenue plus LP swap fees,
              cumulative from 29 Jan 2026. The solid line is USDT actually received by the buyback
              contract, each transfer attributed to the fee epoch whose end is nearest. The dashed
              line (right axis) is PENDLE leaving the Ethereum gauge controller over the same period,
              all of it to Ethereum markets: the Performance stream only; limit-order and co-incentive
              PENDLE is paid elsewhere and is not counted. The controller pays from inventory it already
              held; PENDLE supply has been flat. Other chains&apos; AIM is in the AIM card.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="rise rise-4 border-0 bg-card/80">
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
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4 sm:grid-cols-4">
              <Stat
                label="ETH gauge spend"
                value={fmtInt(r.totals.emittedPendle)}
                unit="PENDLE"
                usd={usdOf(r.totals.emittedPendle, pendleUsd)}
                sub={`Performance stream only, via the gauge controller; ${fmtInt(r.gaugePendle)} PENDLE still in it; USD at the live quote`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rise rise-5 border-0 bg-card/80 ring-1 ring-boost/20">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-boost">Current AIM assignment</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">{r.aim.markets} markets</span>
            </div>
            <Stat
              label="Assigned by AIM"
              value={fmtCompact(r.aim.pendle)}
              unit="PENDLE"
              usd={usdOf(r.aim.pendle, pendleUsd)}
              tone="boost"
              size="lg"
              sub="PENDLE per week as Pendle's /pendle-emission reports it, all chains; not all of it goes to LPs"
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

      <Card className="rise rise-5 border-0 bg-card/80">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
            <Eyebrow>Every fee epoch</Eyebrow>
            <span className="font-mono text-[10px] text-muted-foreground">
              USD from DefiLlama and USDT Transfer logs; since 29 Jan 2026
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Epoch</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-spendle">YT + other</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-vependle">Swap</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">LP</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-spendle">Funded</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-spendle">Bought</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Treasury</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-boost">Ops</TableHead>
                <TableHead className="pr-4 text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">ETH gauge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...r.epochs].reverse().map((row) => (
                <TableRow key={row.start} className="tabular font-mono text-xs">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <span>{fmtDate(row.start)}</span>
                      {!row.complete && (
                        <Badge variant="outline" className="font-mono text-[10px] text-boost ring-boost/30">
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
            </TableBody>
          </Table>
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
            arrive a day late; the 27 Jan 2026 row starts at the 29 Jan snapshot. ETH gauge PENDLE
            uses epoch boundaries approximated from block times.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
