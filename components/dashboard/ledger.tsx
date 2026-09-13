import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtCompact, fmtDate, fmtInt, fmtMult, fmtPct, fmtUsd, fmtUsdPrice } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ExpandableTable } from "./expandable-table";
import { SectionHeading, TxLink } from "./primitives";

export function Ledger({ data }: { data: TrackerData }) {
  const rows = [...data.distributions].reverse();
  return (
    <section id="ledger" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="06"
        title="Distribution ledger"
        lede="Every distribution: PENDLE bought and USDT paid, sPENDLE paid to stakers, the eligible (unclaimed rewards included) and virtual sPENDLE it was split over, and that epoch's plain and boosted APR."
      />
      <Card className="">
        <CardContent className="px-0">
          <ExpandableTable
            noun="distributions"
            head={
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-medium text-muted-foreground">#</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Distributed</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">sPENDLE paid</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">USDT spent</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Avg price</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Eligible sPENDLE</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Virtual sPENDLE</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Avg mult.</TableHead>
                <TableHead className="text-right text-xs font-medium text-spendle">Plain APR</TableHead>
                <TableHead className="text-right text-xs font-medium text-boost">Boosted APR</TableHead>
                <TableHead className="pr-4 text-right text-xs font-medium text-muted-foreground">Tx</TableHead>
              </TableRow>
            }
            rows={rows.map((d) => (
              <TableRow key={d.txHash} className="tabular text-xs">
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
