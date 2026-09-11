import { TRACKER_MAX_AGE_SECONDS, type TrackerData } from "@/lib/pendle/tracker";
import { REPO_URL } from "@/lib/pendle/config";
import { fmtDateTime, fmtInt, fmtUsdPrice } from "@/lib/format";
import { Eyebrow } from "./primitives";
import { RefreshButton } from "./refresh-button";
import { GitHubLink } from "./github-link";
import { ThemeToggle } from "./theme-toggle";
import { HeaderMenu } from "./header-menu";

export function Header({ data }: { data: TrackerData }) {
  return (
    <header className="relative flex flex-col gap-8">
      {/* Phones: the three actions collapse into one menu knob at the top right. */}
      <div className="absolute right-0 top-0 sm:hidden">
        <HeaderMenu repoUrl={REPO_URL} />
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-2 pr-10 sm:pr-0">
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
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="hidden items-center gap-2 sm:flex">
            <ThemeToggle />
            <GitHubLink />
            <RefreshButton />
          </div>
          <div className="sm:text-right">
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
