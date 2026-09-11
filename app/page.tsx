import { isAddress } from "viem";
import { getTrackerData } from "@/lib/pendle/tracker";
import { getPosition } from "@/lib/pendle/position";
import { Header } from "@/components/dashboard/header";
import { Balances } from "@/components/dashboard/balances";
import { Yield } from "@/components/dashboard/yield";
import { Dilution } from "@/components/dashboard/dilution";
import { Revenue } from "@/components/dashboard/revenue";
import { Ledger } from "@/components/dashboard/ledger";
import { Position } from "@/components/dashboard/position";
import { Methodology } from "@/components/dashboard/methodology";
import { GitHubMark } from "@/components/dashboard/github-link";
import { REPO_URL } from "@/lib/pendle/config";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/">) {
  const { address } = await searchParams;
  const preset = typeof address === "string" ? address.trim() : "";
  const [data, position] = await Promise.all([
    getTrackerData(),
    preset && isAddress(preset, { strict: false }) ? getPosition(preset) : null,
  ]);
  return (
    <main className="grain relative mx-auto flex w-full max-w-7xl flex-col gap-20 px-4 py-10 sm:px-8 sm:py-14">
      <Header data={data} />
      <Balances data={data} />
      <Yield data={data} />
      <Dilution data={data} />
      <Revenue data={data} />
      <Ledger data={data} />
      <Position initialHex={preset.replace(/^0x/i, "")} initial={position} />
      <Methodology data={data} />
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground">
        <span>Not affiliated with Pendle. Numbers are computed from public contract state; verify before acting.</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <GitHubMark className="size-3.5" />
          Penconomics · source on GitHub
        </a>
      </footer>
    </main>
  );
}
