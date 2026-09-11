"use client";

import { useState, type FormEvent } from "react";
import { isAddress } from "viem";
import { Search } from "lucide-react";
import { cn } from "cn";
import type { PositionData } from "@/lib/pendle/position";
import { EPOCHS_PER_YEAR } from "@/lib/pendle/config";
import {
  fmtCompact,
  fmtDate,
  fmtDays,
  fmtInt,
  fmtMult,
  fmtNum,
  fmtPct,
  fmtUsd,
  fmtUsdPrice,
  usdOf,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PersonalAprChart } from "./charts";
import { Eyebrow, LineSwatch, SectionHeading, Stat, TxLink } from "./primitives";
import { CopyButton } from "./copy-button";

const EPY = EPOCHS_PER_YEAR.toFixed(2);
const HEX40 = /^[0-9a-fA-F]{40}$/;

type State =
  | { kind: "idle" }
  | { kind: "loading"; address: string }
  | { kind: "error"; message: string }
  | { kind: "result"; data: PositionData };

export function Position({
  initialHex,
  initial,
}: {
  initialHex: string;
  initial: PositionData | null;
}) {
  const [hex, setHex] = useState(initialHex);
  const [inputError, setInputError] = useState<string | null>(null);
  const [state, setState] = useState<State>(initial ? { kind: "result", data: initial } : { kind: "idle" });

  async function lookup(candidate: string) {
    const address = `0x${candidate}`;
    if (!HEX40.test(candidate) || !isAddress(address, { strict: false })) {
      setInputError(
        candidate.length === 0
          ? "Enter the 40 hex characters after 0x."
          : `Not an Ethereum address: ${candidate.length}/40 hex characters${/[^0-9a-fA-F]/.test(candidate) ? ", contains non-hex characters" : ""}.`,
      );
      return;
    }
    setInputError(null);
    setState({ kind: "loading", address });
    const res = await fetch(`/api/position?address=${address}`);
    const body = (await res.json()) as PositionData | { error: string };
    if (!res.ok || "error" in body) {
      setState({ kind: "error", message: "error" in body ? body.error : `HTTP ${res.status}` });
      return;
    }
    setState({ kind: "result", data: body });
    const url = new URL(window.location.href);
    url.searchParams.set("address", body.address);
    window.history.replaceState(null, "", url);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void lookup(hex.trim());
  }

  return (
    <section id="position" className="scroll-mt-20 flex flex-col gap-8">
      <SectionHeading
        index="07"
        title="Your position"
        lede="Paste a wallet address. Below is that address's share of the numbers above: holdings, sPENDLE paid per epoch, its own APR including in-kind airdrops, and what the boost costs or earns it until January 2028."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div
            className={cn(
              "flex flex-1 items-stretch overflow-hidden rounded-lg border bg-background/60 font-mono text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring/50",
              inputError ? "border-destructive" : "border-input",
            )}
          >
            <span className="flex select-none items-center border-r border-input bg-muted/60 px-3 text-muted-foreground">
              0x
            </span>
            <input
              value={hex}
              onChange={(e) => {
                setHex(e.target.value.replace(/^0x/i, "").trim());
                setInputError(null);
              }}
              onPaste={(e) => {
                e.preventDefault();
                setHex(e.clipboardData.getData("text").trim().replace(/^0x/i, ""));
                setInputError(null);
              }}
              placeholder="40 hex characters"
              spellCheck={false}
              autoComplete="off"
              maxLength={42}
              aria-label="Wallet address without 0x prefix"
              aria-invalid={inputError ? true : undefined}
              className="w-full bg-transparent px-3 py-2.5 tracking-wide outline-none placeholder:text-muted-foreground/60"
            />
            <span className="flex items-center px-3 text-[11px] text-muted-foreground">{hex.length}/40</span>
          </div>
          <Button type="submit" size="lg" disabled={state.kind === "loading"}>
            <Search />
            {state.kind === "loading" ? "Reading chain…" : "Look up"}
          </Button>
        </div>
        {inputError && <p className="text-xs text-destructive">{inputError}</p>}
      </form>

      {state.kind === "idle" && (
        <p className="text-sm text-muted-foreground">
          Nothing is fetched until you look up an address. The lookup reads the same contracts as the
          rest of the page, plus Pendle&apos;s API for the address&apos;s accrued rewards and in-kind
          airdrops. Held balances are priced at the live PENDLE/USD quote.
        </p>
      )}
      {state.kind === "loading" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 bg-muted/40" />
          ))}
        </div>
      )}
      {state.kind === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <Eyebrow className="text-destructive">Lookup failed</Eyebrow>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-destructive/90">{state.message}</pre>
        </div>
      )}
      {state.kind === "result" && <Result data={state.data} />}
    </section>
  );
}

function Result({ data }: { data: PositionData }) {
  const { sPendle, lock, weight, rewards, apr, outlook, epochs, pendleUsd } = data;
  const rows = [...epochs].reverse();
  const hasStake = sPendle.balance > 0;
  const hasBoost = lock?.boostActive ?? false;
  const locked = lock && lock.amount > 0 ? lock.amount : 0;
  const held = sPendle.balance + sPendle.unclaimed + sPendle.cooldownAmount + locked + sPendle.walletPendle;
  const usd = (qty: number) => usdOf(qty, pendleUsd, 2);

  if (data.empty) {
    return (
      <div className="rounded-lg border border-border p-6">
        <Eyebrow>{data.address}</Eyebrow>
        <p className="mt-2 text-sm text-muted-foreground">
          No sPENDLE, no cooldown in progress, no vePENDLE lock at the snapshot or now, and no sPENDLE
          rewards recorded by Pendle&apos;s API. Nothing to show for this address.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
          <span className="break-all text-foreground">{data.address}</span>
          <CopyButton value={data.address} label="Copy address" />
          <span>at block {fmtInt(data.block.number)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasStake && (
            <Badge variant="outline" className="text-[11px] text-spendle ring-spendle/30">
              sPENDLE staker
            </Badge>
          )}
          {lock && (
            <Badge variant="outline" className="text-[11px] text-vependle ring-vependle/30">
              {hasBoost ? "boosted locker" : "former locker"}
            </Badge>
          )}
        </div>
      </div>

      <Card className="">
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Stat
              label="Dollar value held"
              value={usd(held)}
              tone="spendle"
              size="lg"
              sub={`(sPENDLE incl. unclaimed rewards + locked + cooldown + wallet PENDLE) × ${fmtUsdPrice(pendleUsd)}`}
            />
          </div>
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="sPENDLE"
              value={fmtInt(sPendle.balance + sPendle.unclaimed)}
              usd={usd(sPendle.balance + sPendle.unclaimed)}
              tone="spendle"
              sub={`${fmtInt(sPendle.balance)} in the wallet + ${fmtNum(sPendle.unclaimed)} unclaimed rewards, which keep earning${sPendle.cooldownAmount > 0 ? "" : "; no cooldown in progress"}`}
            />
            <Stat
              label="Locked"
              value={fmtInt(locked)}
              usd={usd(locked)}
              tone="vependle"
              sub={
                lock && lock.amount > 0
                  ? `unlocks ${fmtDate(lock.expiry)}; at the snapshot, ${fmtInt(lock.snapshotAmount)} to ${fmtDate(lock.snapshotExpiry)}`
                  : lock
                    ? `snapshot lock of ${fmtInt(lock.snapshotAmount)} expired ${fmtDate(lock.snapshotExpiry)}; withdrawn`
                    : "no lock at the snapshot, none now"
              }
            />
            <Stat
              label="Cooldown"
              value={fmtInt(sPendle.cooldownAmount)}
              usd={usd(sPendle.cooldownAmount)}
              sub={
                sPendle.cooldownAmount > 0
                  ? `withdrawable ${fmtDate(sPendle.cooldownReadyAt!)}`
                  : "none"
              }
            />
            <Stat
              label="Wallet PENDLE"
              value={fmtInt(sPendle.walletPendle)}
              usd={usd(sPendle.walletPendle)}
              sub="liquid in the wallet, not staked"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Virtual sPENDLE"
              value={fmtInt(lock?.virtualNow ?? 0)}
              tone="boost"
              size="lg"
              sub={
                hasBoost && lock
                  ? `${fmtMult(lock.multiplierNow)} on the snapshot lock, falling to 1× on ${fmtDate(lock.snapshotExpiry)}; counts toward rewards, not a balance you hold`
                  : "no active loyalty boost; counts toward rewards, not a balance you hold"
              }
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Reward weight and share"
              value={fmtPct(weight.share, 4)}
              size="lg"
              sub={`sPENDLE incl. unclaimed rewards + virtual sPENDLE, ${fmtInt(weight.now)} of the eligible total, worth ≈ ${fmtNum(weight.pendingShare, 1)} sPENDLE of the ${fmtCompact(weight.pendingBuyback)} PENDLE bought back so far this epoch`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <Eyebrow>Paid so far</Eyebrow>
            <Stat
              label="Earned (estimate)"
              value={fmtNum(rewards.earnedEstimate)}
              unit="sPENDLE"
              usd={usd(rewards.earnedEstimate)}
              size="lg"
              sub={`${rewards.epochsWithPosition} epochs with a position; your weight ÷ eligible total × each distribution`}
            />
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Stat
                label="Pendle's record"
                value={fmtNum(rewards.apiAccrued)}
                usd={usd(rewards.apiAccrued)}
                sub={`accrued per the Pendle API: ${fmtNum(rewards.claimed)} claimed onchain, ${fmtNum(rewards.unclaimed)} unclaimed (${usd(rewards.unclaimed)})`}
              />
              <Stat
                label="In-kind airdrops"
                value={fmtUsd(rewards.airdropUsd)}
                sub={`≈ ${fmtNum(rewards.airdropPendle)} PENDLE at each epoch's buyback price, over ${rewards.airdropEpochsCovered} epochs with data`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow className="text-spendle">Your APR</Eyebrow>
              <span className="text-[11px] text-muted-foreground">on sPENDLE + locked PENDLE, per year</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Latest, buybacks only"
                value={apr.latestBuyback === null ? "—" : fmtPct(apr.latestBuyback)}
                tone="spendle"
                size="lg"
                sub={`protocol plain ${fmtPct(apr.protocolPlainLatest)}, average locker ${fmtPct(apr.protocolBoostedAvgLatest)}`}
              />
              <Stat
                label="Latest incl. airdrops"
                value={apr.latestTotal === null ? "—" : fmtPct(apr.latestTotal)}
                size="lg"
                sub="airdrops converted to PENDLE at that epoch's buyback price"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Stat
                label="Mean, buybacks only"
                value={apr.meanBuyback === null ? "—" : fmtPct(apr.meanBuyback)}
                sub={`${apr.epochsAveraged} epochs you held a position, buybacks only`}
              />
              <Stat
                label="Mean incl. airdrops"
                value={apr.meanTotal === null ? "—" : fmtPct(apr.meanTotal)}
                sub={`${apr.epochsAveragedTotal} of those epochs with airdrop data`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <Eyebrow className="text-boost">What the boost does to you</Eyebrow>
            {hasStake && (
              <Stat
                label="Dilution on your sPENDLE"
                value={`−${fmtNum(rewards.dilutionCost)}`}
                unit="sPENDLE so far"
                tone="boost"
                size="lg"
                sub={`shortfall vs everyone at 1×; ≈ ${fmtNum(outlook.remainingDilutionCost)} more by ${fmtDate(outlook.boostEndsAt)} at the latest distribution`}
              />
            )}
            {lock && (rewards.premiumEarned > 0 || hasBoost) && (
              <Stat
                label="Premium on your lock"
                value={`+${fmtNum(rewards.premiumEarned)}`}
                unit="sPENDLE so far"
                tone="vependle"
                size="lg"
                sub={`rewards above a 1× count of your locked PENDLE; ≈ ${fmtNum(outlook.remainingPremium)} more before your boost ends`}
              />
            )}
            {hasStake && lock && hasBoost && (
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                Net so far: {rewards.premiumEarned - rewards.dilutionCost >= 0 ? "+" : "−"}
                {fmtNum(Math.abs(rewards.premiumEarned - rewards.dilutionCost))} sPENDLE. Your lock&apos;s
                premium is paid by everyone&apos;s sPENDLE, including yours.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {outlook.aprNow !== null && (
        <Card className="">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Your APR until boost ends</Eyebrow>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Position held as-is, protocol sPENDLE flat, every epoch paying the latest{" "}
                  {fmtInt(outlook.latestDistribution)} sPENDLE. When your lock expires the PENDLE is
                  assumed restaked as sPENDLE at 1×. Buybacks only.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <Stat
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <LineSwatch tone="spendle" />
                      Today
                    </span>
                  }
                  value={fmtPct(outlook.aprNow)}
                />
                {outlook.aprAtUnlockRestaked !== null && (
                  <Stat
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        <LineSwatch tone="vependle" dashed />
                        Your unlock, {fmtDate(outlook.unlockAt!)}
                      </span>
                    }
                    value={fmtPct(outlook.aprAtUnlockRestaked)}
                  />
                )}
                <Stat
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <LineSwatch tone="boost" dashed />
                      Boost ends, {fmtDate(outlook.boostEndsAt)}
                    </span>
                  }
                  value={fmtPct(outlook.aprAfterBoost!)}
                  tone="spendle"
                />
              </div>
            </div>
            <PersonalAprChart points={data.projection} unlockAt={outlook.unlockAt} boostEndsAt={outlook.boostEndsAt} />
          </CardContent>
        </Card>
      )}

      <Card className="">
        <CardContent className="flex flex-col gap-3 px-0">
          <div className="px-4">
            <Eyebrow>Epoch by epoch</Eyebrow>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th className="pl-4">#</Th>
                <Th>Distributed</Th>
                <Th right>Your sPENDLE</Th>
                <Th right>Your lock</Th>
                <Th right>Mult.</Th>
                <Th right>Share</Th>
                <Th right className="text-spendle">sPENDLE earned</Th>
                <Th right>Airdrop → PENDLE</Th>
                <Th right>Buyback px</Th>
                <Th right className="text-spendle">APR</Th>
                <Th right>APR incl. airdrops</Th>
                <Th right className="pr-4">Tx</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.txHash} className={cn("tabular text-xs", e.principal === 0 && "text-muted-foreground/60")}>
                  <TableCell className="pl-4 text-muted-foreground">{e.epoch}</TableCell>
                  <TableCell>{fmtDate(e.timestamp)}</TableCell>
                  <TableCell className="text-right">{fmtInt(e.sPendleBalance + e.sPendleUnclaimed)}</TableCell>
                  <TableCell className="text-right">{e.locked > 0 ? fmtInt(e.locked) : "—"}</TableCell>
                  <TableCell className="text-right">{e.locked > 0 ? fmtMult(e.multiplier) : "—"}</TableCell>
                  <TableCell className="text-right">{fmtPct(e.share, 4)}</TableCell>
                  <TableCell className="text-right text-spendle">{fmtNum(e.sPendleEarned)}</TableCell>
                  <TableCell className="text-right">
                    {e.airdropUsd === null
                      ? <span className="text-muted-foreground/60">no data</span>
                      : e.airdropUsd === 0
                        ? "—"
                        : `${fmtUsd(e.userAirdropUsd!)} → ${fmtNum(e.userAirdropPendle!)} ${e.airdropTokens.length ? `(${e.airdropTokens.join(", ")})` : ""}`}
                  </TableCell>
                  <TableCell className="text-right">${fmtNum(e.execPrice, 3)}</TableCell>
                  <TableCell className="text-right text-spendle">{e.aprBuyback === null ? "—" : fmtPct(e.aprBuyback)}</TableCell>
                  <TableCell className="text-right">{e.aprTotal === null ? "—" : fmtPct(e.aprTotal)}</TableCell>
                  <TableCell className="pr-4 text-right"><TxLink hash={e.txHash} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 pt-2 text-xs leading-relaxed text-muted-foreground">
            Same denomination as the yield section: sPENDLE earned ÷ (your sPENDLE + your locked PENDLE) × {EPY}.
            Airdrops are the one place a dollar figure enters: Pendle&apos;s API reports each epoch&apos;s
            in-kind airdrops in USD, with no valuation timestamp; your share of that is converted to PENDLE
            at the same epoch&apos;s realised buyback price (USDT the buyback contract sent out ÷ PENDLE it
            received between distributions, from the contract&apos;s token transfers; every PENDLE inflow
            counts, not only swap output) and added to the sPENDLE you earned. Held balances above are marked
            to the live PENDLE/USD quote ({fmtUsdPrice(pendleUsd)}); APR stays in token terms. Pendle&apos;s API only covers the
            last 12 epochs, so earlier rows show &ldquo;no data&rdquo; and are left out of the
            airdrop-inclusive mean. &ldquo;Your sPENDLE&rdquo; is your wallet balance plus rewards accrued and not yet claimed, just
            before each distribution; unclaimed rewards keep earning, so they count. The estimate
            assumes you were active in every epoch.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Boost ends {fmtDate(outlook.boostEndsAt)}, {fmtDays((outlook.boostEndsAt - data.block.timestamp) / 86_400)} away.
      </p>
    </div>
  );
}

function Th({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <TableHead
      className={cn(
        "text-xs font-medium text-muted-foreground",
        right && "text-right",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}
