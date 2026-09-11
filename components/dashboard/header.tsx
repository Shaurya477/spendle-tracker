import { TRACKER_MAX_AGE_SECONDS, type TrackerData } from "@/lib/pendle/tracker";
import { fmtDateTime, fmtInt, fmtUsdPrice } from "@/lib/format";
import { Eyebrow } from "./primitives";
import { RefreshButton } from "./refresh-button";
import { GitHubLink } from "./github-link";
import { ThemeToggle } from "./theme-toggle";

export function Header({ data }: { data: TrackerData }) {
  return (
    <header className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>Pendle · Ethereum mainnet</Eyebrow>
          <h1
            aria-label="Penconomics"
            className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            <span className="text-vependle">Pen</span>
            <span className="text-spendle">conomics</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pendle&apos;s protocol fees and incentives, sPENDLE yield, and the vePENDLE loyalty boost
            that dilutes stakers until it ends in January 2028.
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-col sm:items-end sm:gap-3">
          <div className="order-2 flex shrink-0 items-center gap-2 sm:order-1">
            <ThemeToggle />
            <GitHubLink />
            <RefreshButton />
          </div>
          <div className="order-1 shrink-0 sm:order-2 sm:text-right">
            <Eyebrow className="text-spendle">$PENDLE</Eyebrow>
            <div className="tabular mt-1 font-mono text-4xl leading-none tracking-tight text-spendle">
              {fmtUsdPrice(data.pendleUsd)}
            </div>
            <div className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <div>Pendle API quote</div>
              <div>block {fmtInt(data.block.number)}</div>
              <div>{fmtDateTime(data.block.timestamp)}</div>
              <div>recomputed every {TRACKER_MAX_AGE_SECONDS / 60} min</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
