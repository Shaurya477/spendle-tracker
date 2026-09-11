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
const LP = "oklch(0.62 0.02 80)";

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
            LPs keep 20% of swap fees; the rest, with all YT fees, is protocol take, split 80%
            buybacks, 10% treasury, 10% operations. LP incentives are paid in PENDLE the gauge
            controller already holds; nothing is minted.
          </>
        }
      />

      <div className="rise rise-1 grid gap-4 rounded-xl border border-border/70 bg-background/40 p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Latest complete epoch</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {fmtDate(e.start)} → {fmtDate(ends(e))}. The epoch starting {fmtDate(current.start)}{" "}
            {current.complete ? "is complete." : `is in progress (${current.days} days in).`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Documented split</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Buybacks, treasury, and operations are the documented 80/10/10 split of protocol take,
            not observed wallet balances. How bought-back PENDLE becomes sPENDLE is in the yield
            section.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Pendle V2 only</Eyebrow>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Daily USD from DefiLlama&apos;s Pendle V2 label, summed across chains, from 29 Jan 2026;
            Boros and vePENDLE-era fees are excluded. YT and swap are backed out from two identities:
            LP fees = 20% of gross swap, protocol revenue = YT + 80% of swap.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rise rise-2 border-0 bg-card/80 ring-1 ring-spendle/20">
          <CardContent>
            <Stat
              label="YT fees"
              value={fmtUsd(e.yt)}
              tone="spendle"
              size="lg"
              sub={`${fmtPct(share(e.yt, gross), 1)} of gross · 5% of YT yield, all protocol take`}
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
              sub={`${fmtPct(share(e.swap, gross), 1)} of gross · ${fmtUsd(e.lp)} to LPs, ${fmtUsd(e.swapToProtocol)} to protocol`}
            />
          </CardContent>
        </Card>
        <Card className="rise rise-4 border-0 bg-card/80">
          <CardContent>
            <Stat
              label="Protocol take"
              value={fmtUsd(e.revenue)}
              size="lg"
              sub={`${fmtUsd(e.buyback)} buybacks · ${fmtUsd(e.treasury)} treasury · ${fmtUsd(e.ops)} ops`}
            />
          </CardContent>
        </Card>
        <Card className="rise rise-5 border-0 bg-card/80">
          <CardContent>
            <Stat
              label="Gross fees"
              value={fmtUsd(gross)}
              size="lg"
              sub={`YT + swap · LPs keep ${fmtPct(share(e.lp, gross), 1)} of this epoch`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rise rise-2 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Gross fees · latest complete epoch</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">100% = YT + swap</span>
            </div>
            <Split
              parts={[
                { label: "YT → protocol", value: e.yt, color: YT },
                { label: "Swap → protocol", value: e.swapToProtocol, color: SWAP },
                { label: "Swap → LPs", value: e.lp, color: LP },
              ]}
            />
          </CardContent>
        </Card>
        <Card className="rise rise-3 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>Protocol take · 80 / 10 / 10</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">100% = YT + 80% of swap</span>
            </div>
            <Split
              parts={[
                { label: "Buybacks", value: e.buyback, color: YT },
                { label: "Treasury", value: e.treasury, color: TREASURY },
                { label: "Operations", value: e.ops, color: OPS },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rise rise-3 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>YT vs swap by epoch</Eyebrow>
              <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-spendle" /> YT
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
                  <span className="inline-block size-2 rounded-sm bg-spendle" /> Buybacks
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
              Stacked USD is the documented fee split, cumulative from 29 Jan 2026. The dashed line
              (right axis) is PENDLE leaving the Ethereum gauge controller over the same period, paid
              to markets plus unused AIM returned to treasury. It is drawn from inventory the
              controller already held; PENDLE supply has been flat. Other chains&apos; AIM is in the
              weekly card.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="rise rise-4 border-0 bg-card/80">
          <CardContent className="flex flex-col gap-6">
            <Eyebrow>Since 29 Jan 2026 · sPENDLE era</Eyebrow>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="Gross fees" value={fmtUsd(r.totals.yt + r.totals.swap)} sub={`YT ${fmtUsd(r.totals.yt)} · swap ${fmtUsd(r.totals.swap)}`} />
              <Stat label="Buybacks" value={fmtUsd(r.totals.buyback)} tone="spendle" sub="80% of protocol take" />
              <Stat label="Treasury" value={fmtUsd(r.totals.treasury)} sub="10% of protocol take" />
              <Stat label="Operations" value={fmtUsd(r.totals.ops)} sub="10% of protocol take" />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
              <Stat label="LP swap fees" value={fmtUsd(r.totals.lp)} sub="20% of gross swap" />
              <Stat
                label="ETH gauge spend"
                value={fmtInt(r.totals.emittedPendle)}
                unit="PENDLE"
                usd={usdOf(r.totals.emittedPendle, pendleUsd)}
                sub={`inventory remaining ${fmtInt(r.gaugePendle)} · live USD`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rise rise-5 border-0 bg-card/80 ring-1 ring-boost/20">
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-boost">AIM · this week</Eyebrow>
              <span className="font-mono text-[10px] text-muted-foreground">{r.aim.markets} markets</span>
            </div>
            <Stat
              label="Assigned to LPs"
              value={fmtCompact(r.aim.pendle)}
              unit="PENDLE"
              usd={usdOf(r.aim.pendle, pendleUsd)}
              tone="boost"
              size="lg"
              sub="this week's AIM assignment across all chains, from Pendle's API"
            />
            <Split
              format={(n) => `${fmtCompact(n)} PENDLE`}
              parts={[
                { label: "TVL stream", value: r.aim.tvl, color: YT },
                { label: "Fee stream", value: r.aim.fee, color: SWAP },
                { label: "Limit order", value: r.aim.limitOrder, color: TREASURY },
                { label: "Discretionary", value: r.aim.discretionary, color: OPS },
                { label: "Co-bribing", value: r.aim.cobribing, color: LP },
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
              USD from DefiLlama · ETH gauge PENDLE since 29 Jan 2026
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Epoch</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-spendle">YT</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-vependle">Swap</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">LP</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-spendle">Buyback</TableHead>
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
                  <TableCell className="text-right text-spendle">{fmtUsd(row.buyback)}</TableCell>
                  <TableCell className="text-right">{fmtUsd(row.treasury)}</TableCell>
                  <TableCell className="text-right text-boost">{fmtUsd(row.ops)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {row.emittedPendle > 0 ? fmtInt(row.emittedPendle) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
