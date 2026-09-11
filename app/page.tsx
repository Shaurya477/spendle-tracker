import { isAddress } from "viem";
import { getTrackerData } from "@/lib/pendle/tracker";
import { getPosition } from "@/lib/pendle/position";
import { MobileHeader, Rail } from "@/components/dashboard/header";
import { Hero } from "@/components/dashboard/hero";
import { Balances } from "@/components/dashboard/balances";
import { Yield } from "@/components/dashboard/yield";
import { Dilution } from "@/components/dashboard/dilution";
import { Revenue } from "@/components/dashboard/revenue";
import { Ledger } from "@/components/dashboard/ledger";
import { Thesis } from "@/components/dashboard/thesis";
import { Position } from "@/components/dashboard/position";
import { Methodology } from "@/components/dashboard/methodology";
import { GitHubMark } from "@/components/dashboard/github-link";
import { XMark } from "@/components/dashboard/x-mark";
import { SectionBar } from "@/components/dashboard/section-nav";
import { AUTHOR_X_HANDLE, AUTHOR_X_URL, REPO_URL } from "@/lib/pendle/config";

const SECTIONS = [
  { id: "balances", index: "01", title: "Balances" },
  { id: "yield", index: "02", title: "Yield" },
  { id: "dilution", index: "03", title: "Dilution" },
  { id: "fees", index: "04", title: "Fees" },
  { id: "ledger", index: "05", title: "Ledger" },
  { id: "thesis", index: "06", title: "Thesis" },
  { id: "position", index: "07", title: "Position" },
  { id: "methodology", index: "08", title: "Methodology" },
];

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/">) {
  const { address } = await searchParams;
  const preset = typeof address === "string" ? address.trim() : "";
  const [data, position] = await Promise.all([
    getTrackerData(),
    preset && isAddress(preset, { strict: false }) ? getPosition(preset) : null,
  ]);
  return (
    <div
      id="top"
      className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-20"
    >
      <Rail data={data} sections={SECTIONS} />
      <main className="flex min-w-0 flex-col gap-16 py-8 sm:gap-24 sm:py-12 lg:py-10">
        <MobileHeader data={data} />
        <Hero data={data} />
        <SectionBar sections={SECTIONS} />
        <Balances data={data} />
        <Yield data={data} />
        <Dilution data={data} />
        <Revenue data={data} />
        <Ledger data={data} />
        <Thesis data={data} />
        <Position initialHex={preset.replace(/^0x/i, "")} initial={position} />
        <Methodology data={data} />
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>Not affiliated with Pendle. Numbers are computed from public contract state; verify before acting.</span>
          <div className="flex items-center gap-4">
            <a
              href={AUTHOR_X_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <XMark className="size-3" />
              Built by {AUTHOR_X_HANDLE}
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <GitHubMark className="size-3.5" />
              Source on GitHub
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
