import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtInt, fmtMult, fmtPct, fmtUsd, fmtUsdPrice } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ExpandableTable } from "./expandable-table";
import { SectionHeading, TxLink, keepTokenCase } from "./primitives";

export function Ledger({ data }: { data: TrackerData }) {
  const rows = [...data.distributions].reverse();
  return (
    <section id="ledger" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="05"
        title="Distribution ledger"
        lede="Every distribution found onchain: the PENDLE the buyback contract bought, what it spent in USDT, the sPENDLE it sent to the Merkle distributor, the eligible and virtual balances the block before, and the plain and boosted APR for that epoch."
      />
      <Card className="rise rise-1 border-0 bg-card/80">
        <CardContent className="px-0">
          <ExpandableTable
            noun="distributions"
            head={
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">#</TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Distributed</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{keepTokenCase("sPENDLE paid")}</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">USDT spent</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Avg price</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{keepTokenCase("Eligible sPENDLE")}</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{keepTokenCase("Virtual sPENDLE")}</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Avg mult.</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-spendle">Plain APR</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-boost">Boosted APR</TableHead>
                <TableHead className="pr-4 text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Tx</TableHead>
              </TableRow>
            }
            rows={rows.map((d) => (
              <TableRow key={d.txHash} className="tabular font-mono text-xs">
                  <TableCell className="pl-4 text-muted-foreground">{d.epoch}</TableCell>
                  <TableCell>{fmtDate(d.timestamp)}</TableCell>
                  <TableCell className="text-right">{fmtInt(d.amount)}</TableCell>
                  <TableCell className="text-right">{fmtUsd(d.usdtSpent)}</TableCell>
                  <TableCell className="text-right">{fmtUsdPrice(d.usdtSpent / d.pendleBought)}</TableCell>
                  <TableCell className="text-right">{fmtCompact(d.eligibleSPendle)}</TableCell>
                  <TableCell className="text-right">{fmtCompact(d.virtualSPendle)}</TableCell>
                  <TableCell className="text-right">{fmtMult(d.avgMultiplier)}</TableCell>
                  <TableCell className="text-right text-spendle">{fmtPct(d.aprPlain)}</TableCell>
                  <TableCell className="text-right text-boost">{fmtPct(d.aprBoostedAvg)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <TxLink hash={d.txHash} />
                  </TableCell>
                </TableRow>
            ))}
          />
        </CardContent>
      </Card>
    </section>
  );
}
