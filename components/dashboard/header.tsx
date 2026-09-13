import { TRACKER_MAX_AGE_SECONDS, type TrackerData } from "@/lib/pendle/tracker";
import { fmtDateTime, fmtInt, fmtUsdPrice } from "@/lib/format";
import { AUTHOR_X_HANDLE, AUTHOR_X_URL, REPO_URL } from "@/lib/pendle/config";
import { GitHubLink } from "./github-link";
import { HeaderMenu } from "./header-menu";
import { PendleCoin } from "./pendle-coin";
import { RefreshButton } from "./refresh-button";
import { SectionList, type NavSection } from "./section-nav";
import { ThemeToggle } from "./theme-toggle";
import { XMark } from "./x-mark";

function Wordmark({ className }: { className?: string }) {
  return (
    <a href="#top" aria-label="Penconomics" className={className}>
      <span className="font-display leading-none">
        <span className="text-vependle">Pen</span>
        <span className="text-spendle">conomics</span>
      </span>
    </a>
  );
}

function Price({ data }: { data: TrackerData }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">$PENDLE</div>
      <div className="font-figure text-3xl leading-none text-spendle">{fmtUsdPrice(data.pendleUsd)}</div>
      <div className="tabular text-[11px] leading-relaxed text-muted-foreground">
        Pendle API quote, block {fmtInt(data.block.number)}
        <br />
        {fmtDateTime(data.block.timestamp)}, recomputed every {TRACKER_MAX_AGE_SECONDS / 60} min
      </div>
    </div>
  );
}

/** Desktop: sticky left column with the wordmark, section list, live quote, and actions. */
export function Rail({ data, sections }: { data: TrackerData; sections: NavSection[] }) {
  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:py-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Wordmark className="text-[2rem]" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PendleCoin className="size-3.5 shrink-0" />
            Pendle · Ethereum mainnet
          </div>
        </div>
        <SectionList sections={sections} />
      </div>
      <div className="flex flex-col gap-6">
        <Price data={data} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <GitHubLink />
          <RefreshButton />
        </div>
        <a
          href={AUTHOR_X_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <XMark className="size-3" />
          Built by {AUTHOR_X_HANDLE}
        </a>
      </div>
    </aside>
  );
}

/**
 * Phones and tablets: wordmark and menu knob; the quote lives inside the menu. The negative margin
 * pulls the hero up under the header, closer than the page's section gap.
 */
export function MobileHeader({ data }: { data: TrackerData }) {
  return (
    <header className="-mb-8 flex items-start justify-between gap-4 sm:-mb-14 lg:hidden">
      <div className="flex flex-col gap-1.5">
        <Wordmark className="text-[2.4rem]" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PendleCoin className="size-3.5 shrink-0" />
          Pendle · Ethereum mainnet
        </div>
      </div>
      <HeaderMenu repoUrl={REPO_URL} quote={<Price data={data} />} />
    </header>
  );
}
