import { getTrackerData } from "@/lib/pendle/tracker";
import { Header } from "@/components/dashboard/header";
import { Balances } from "@/components/dashboard/balances";
import { Yield } from "@/components/dashboard/yield";
import { Dilution } from "@/components/dashboard/dilution";
import { Ledger } from "@/components/dashboard/ledger";
import { Methodology } from "@/components/dashboard/methodology";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getTrackerData();
  return (
    <main className="grain relative mx-auto flex w-full max-w-7xl flex-col gap-20 px-4 py-10 sm:px-8 sm:py-14">
      <Header data={data} />
      <Balances data={data} />
      <Yield data={data} />
      <Dilution data={data} />
      <Ledger data={data} />
      <Methodology data={data} />
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground">
        <span>Not affiliated with Pendle. Numbers are computed from public contract state; verify before acting.</span>
        <span>sPENDLE Tracker</span>
      </footer>
    </main>
  );
}
