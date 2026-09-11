import type { TrackerData } from "@/lib/pendle/tracker";
import { fmtDateTime, fmtInt, fmtUsdPrice } from "@/lib/format";
import { Eyebrow } from "./primitives";
import { RefreshButton } from "./refresh-button";

export function Header({ data }: { data: TrackerData }) {
  return (
    <header className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Pendle Protocol · Ethereum mainnet · public contracts</Eyebrow>
          <h1
            aria-label="Penconomics"
            className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            <span className="text-vependle">Pen</span>
            <span className="text-spendle">conomics</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            The economics of Pendle. Protocol fees and incentives, sPENDLE yield, and the two-year
            hand-off from locked vePENDLE.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <RefreshButton />
          <div className="text-right">
            <Eyebrow className="text-spendle">PENDLE · USD</Eyebrow>
            <div className="tabular mt-1 font-mono text-4xl leading-none tracking-tight text-spendle">
              {fmtUsdPrice(data.pendleUsd)}
            </div>
            <div className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <div>Pendle asset price · live</div>
              <div>block {fmtInt(data.block.number)}</div>
              <div>{fmtDateTime(data.block.timestamp)}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
