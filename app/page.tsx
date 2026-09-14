import { getTrackerData } from "@/lib/pendle/tracker";
import { MobileHeader, Rail } from "@/components/dashboard/header";
import { Hero } from "@/components/dashboard/hero";
import { Balances } from "@/components/dashboard/balances";
import { Holders } from "@/components/dashboard/holders";
import { Yield } from "@/components/dashboard/yield";
import { Dilution } from "@/components/dashboard/dilution";
import { Revenue } from "@/components/dashboard/revenue";
import { Ledger } from "@/components/dashboard/ledger";
import { Valuation } from "@/components/dashboard/valuation";
import { Thesis } from "@/components/dashboard/thesis";
import { Position } from "@/components/dashboard/position";
import { Methodology } from "@/components/dashboard/methodology";
import { GitHubMark } from "@/components/dashboard/github-link";
import { XMark } from "@/components/dashboard/x-mark";
import { SectionBar } from "@/components/dashboard/section-nav";
import { ScrollTop } from "@/components/dashboard/scroll-top";
import { AUTHOR_X_HANDLE, AUTHOR_X_URL, REPO_URL } from "@/lib/pendle/config";

const SECTIONS = [
  { id: "balances", index: "01", title: "Balances" },
  { id: "holders", index: "02", title: "Holders" },
  { id: "yield", index: "03", title: "Yield" },
  { id: "dilution", index: "04", title: "Dilution" },
  { id: "fees", index: "05", title: "Fees" },
  { id: "ledger", index: "06", title: "Ledger" },
  { id: "valuation", index: "07", title: "Valuation" },
  { id: "thesis", index: "08", title: "Thesis" },
  { id: "position", index: "09", title: "Position" },
  { id: "methodology", index: "10", title: "Methodology" },
];

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/">) {
  // The wallet in the URL is not resolved here: the page paints from the cached dataset and the
  // Position section fetches the wallet client-side after mount, as it does for a remembered wallet.
  const { address } = await searchParams;
  const preset = typeof address === "string" ? address.trim() : "";
  const data = await getTrackerData();
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
        <Holders data={data} />
        <Yield data={data} />
        <Dilution data={data} />
        <Revenue data={data} />
        <Ledger data={data} />
        <Valuation data={data} />
        <Thesis data={data} />
        <Position initialHex={preset.replace(/^0x/i, "")} />
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
      <ScrollTop />
    </div>
  );
}
