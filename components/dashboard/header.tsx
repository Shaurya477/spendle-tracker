import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { Eyebrow } from "./primitives";
import { RefreshButton } from "./refresh-button";

export function Header({ data }: { data: TrackerData }) {
  return (
    <header className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Pendle Protocol · Ethereum mainnet · read directly from contracts</Eyebrow>
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">
            <span className="text-vependle">vePENDLE</span>
            <span className="text-muted-foreground"> → </span>
            <span className="text-spendle">sPENDLE</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Tracking the two-year hand-off from locked PENDLE to staked PENDLE: what is staked, what
            is still locked, who earns what, and how fast the loyalty boost that favours old lockers
            fades out.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RefreshButton />
          <div className="text-right font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div>block {fmtInt(data.block.number)}</div>
            <div>{fmtDateTime(data.block.timestamp)}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
