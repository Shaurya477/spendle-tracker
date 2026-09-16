import type { TrackerData } from "@/lib/pendle/tracker";
import type { WalletCategory } from "@/lib/pendle/config";
import { fmtCompact, fmtDate, fmtInt, fmtPct, usdOf } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { ExpandableTable } from "./expandable-table";
import { AddressLink, Eyebrow, SectionHeading, Stat } from "./primitives";

type Segment = { key: keyof Omit<TrackerData["holders"]["split"], "total">; label: string; className: string; tip: string };

const SEGMENTS: Segment[] = [
  { key: "staked", label: "Staked", className: "bg-spendle", tip: "PENDLE in the sPENDLE contract, cooldown queue included." },
  { key: "locked", label: "Locked", className: "bg-vependle", tip: "PENDLE in the vePENDLE contract, active and expired locks." },
  { key: "pendle", label: "Pendle wallets", className: "bg-chart-4", tip: "Governance multisig, ecosystem fund, team tokens multisig, treasury." },
  { key: "investors", label: "Investors", className: "bg-chart-4/60", tip: "Binance Labs." },
  { key: "exchanges", label: "Exchanges", className: "bg-boost", tip: "Labelled Binance, Crypto.com and Gate.io wallets. Unlabelled exchange wallets fall under “everything else”." },
  { key: "bridged", label: "On other chains", className: "bg-chart-lp", tip: "Locked in mainnet bridge escrows: Arbitrum, Wormhole Portal, Base, Optimism. Circulates on those chains." },
  { key: "contracts", label: "Protocol contracts", className: "bg-foreground/50", tip: "Buyback contract inventory and the gauge controller's emissions inventory." },
  { key: "other", label: "Everything else", className: "bg-muted-foreground/35", tip: "Wallets, DEX pools and unlabelled exchange wallets: the tradeable float on mainnet." },
];

const CATEGORY_LABEL: Record<WalletCategory, string> = {
  pendle: "Pendle",
  investor: "Investor",
  exchange: "Exchange",
  bridge: "Bridge",
  locker: "Liquid locker",
  contract: "Protocol contract",
};

function Delta({ n }: { n: number }) {
  if (Math.abs(n) < 1) return <span className="tabular text-muted-foreground/60">0</span>;
  return (
    <span className={`tabular ${n > 0 ? "text-spendle" : "text-boost"}`}>
      {n > 0 ? "+" : "−"}
      {fmtCompact(Math.abs(n))}
    </span>
  );
}

export function Holders({ data }: { data: TrackerData }) {
  const { holders, pendleUsd, pendleSupply, vePendle } = data;
  const { split, wallets } = holders;
  const float = split.other;
  const offMarket = split.staked + split.locked + split.pendle + split.investors + split.bridged + split.contracts;
  const rows = [...wallets]
    .map((w) => ({ ...w, held: w.pendle + w.sPendle + w.locked }))
    .filter((w) => w.held >= 1)
    .sort((a, b) => b.held - a.held);
  const known = rows.reduce((s, w) => s + w.held, 0);

  return (
    <section id="holders" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="02"
        title="Who holds PENDLE"
        methodId="method-holders"
        lede={
          <>
            {fmtCompact(pendleSupply.now)} PENDLE exist. Where they sit decides how much can actually trade:{" "}
            <span className="tabular text-foreground">{fmtPct(offMarket / split.total, 0)}</span> is staked, locked,
            in Pendle&apos;s own wallets, or escrowed for other chains;{" "}
            <span className="tabular text-foreground">{fmtPct(split.exchanges / split.total, 0)}</span> sits on
            labelled exchanges and <span className="tabular text-foreground">{fmtPct(float / split.total, 0)}</span> in
            open wallets and pools.
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Eyebrow tip="Live balances of the labelled wallets and the two staking contracts, against PENDLE total supply. Labels are Etherscan's and Dune's public tags; only wallets that hold PENDLE on mainnet are listed.">
              How the supply splits
            </Eyebrow>
            <div className="text-xs text-muted-foreground">
              {fmtInt(split.total)} PENDLE, {usdOf(split.total, pendleUsd)}
            </div>
          </div>
          <div className="flex h-4 w-full overflow-hidden rounded-sm bg-muted">
            {SEGMENTS.map((s) => (
              <div key={s.key} className={s.className} style={{ width: `${(split[s.key] / split.total) * 100}%` }} title={`${s.label}: ${fmtCompact(split[s.key])}`} />
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {SEGMENTS.map((s) => (
              <div key={s.key} className="flex flex-col gap-0.5">
                <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span aria-hidden="true" className={`inline-block size-2 rounded-sm ${s.className}`} />
                  <Eyebrow className="text-[11px]" tip={s.tip} tipLabel={s.label}>
                    {s.label}
                  </Eyebrow>
                </dt>
                <dd className="flex items-baseline gap-1.5">
                  <span className="tabular text-base text-foreground">{fmtCompact(split[s.key])}</span>
                  <span className="tabular text-[11px] text-muted-foreground">{fmtPct(split[s.key] / split.total, 1)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <Stat
              label="Off the market"
              value={fmtPct(offMarket / split.total, 1)}
              tone="spendle"
              size="lg"
              sub={`${fmtCompact(offMarket)} PENDLE staked, locked, held by Pendle, or escrowed for other chains`}
              tip="Staked (PENDLE in the sPENDLE contract) + locked (in vePENDLE) + Pendle's multisigs and treasury + investor wallets + bridge escrows + the buyback contract and gauge controller, as a share of total supply. None of it can be sold without first unstaking, unlocking, bridging back, or a Pendle decision."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="On labelled exchanges"
              value={fmtCompact(split.exchanges)}
              tone="boost"
              size="lg"
              usd={usdOf(split.exchanges, pendleUsd)}
              sub={`${fmtPct(split.exchanges / split.total, 1)} of supply; ${fmtPct(split.exchanges / (split.exchanges + float), 0)} of what is not staked, locked, held or bridged`}
              tip="PENDLE in the labelled Binance, Crypto.com and Gate.io wallets on mainnet, from their live balances. Exchange inventory is the most readily sellable supply, but it is customers' deposits, not the exchange's own position. Unlabelled exchange wallets and PENDLE on other chains are not counted."
            />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <Stat
              label="Locked by liquid lockers"
              value={fmtCompact(rows.filter((w) => w.category === "locker").reduce((s, w) => s + w.locked, 0))}
              tone="vependle"
              size="lg"
              sub={`Penpie, Equilibria and Stake DAO; ${fmtPct(rows.filter((w) => w.category === "locker").reduce((s, w) => s + w.locked, 0) / vePendle.activeLocked, 0)} of active locked PENDLE`}
              tip="PENDLE under a live vePENDLE lock in the three liquid-locker protocols' positions, read from the vePENDLE contract. These protocols keep their locks at the maximum, so this PENDLE is the slowest to become liquid and carries the largest share of the boost."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4">
            <Eyebrow tip="PENDLE in the wallet, plus its sPENDLE and PENDLE locked in vePENDLE. Changes are in wallet PENDLE against the balance about 7 and 30 days ago (50,400 and 216,000 blocks). A negative change at an exchange is withdrawals to users or other venues, not necessarily selling.">
              Labelled wallets
            </Eyebrow>
            <div className="text-xs text-muted-foreground">
              {rows.length} wallets, {fmtCompact(known)} PENDLE, {fmtPct(known / split.total, 0)} of supply
            </div>
          </div>
          <ExpandableTable
            noun="wallets"
            initial={6}
            order="largest"
            head={
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-medium text-muted-foreground">Wallet</TableHead>
                <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Type</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Held</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">7 d</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">30 d</TableHead>
                <TableHead className="hidden pr-4 text-right text-xs font-medium text-muted-foreground sm:table-cell">Locked until</TableHead>
              </TableRow>
            }
            rows={rows.map((w) => (
              <TableRow key={w.address} className="text-xs">
                <TableCell className="pl-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground">{w.label}</span>
                    <AddressLink address={w.address} />
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{CATEGORY_LABEL[w.category]}</TableCell>
                <TableCell className="tabular text-right text-foreground">
                  {fmtCompact(w.held)}
                  {w.locked > 0 && <div className="text-[10px] text-vependle">locked</div>}
                </TableCell>
                <TableCell className="text-right">
                  <Delta n={w.pendle - w.pendle7d} />
                </TableCell>
                <TableCell className="text-right">
                  <Delta n={w.pendle - w.pendle30d} />
                </TableCell>
                <TableCell className="tabular hidden pr-4 text-right text-muted-foreground sm:table-cell">
                  {w.locked > 0 ? fmtDate(w.lockExpiry) : ""}
                </TableCell>
              </TableRow>
            ))}
          />
        </CardContent>
      </Card>
    </section>
  );
}
