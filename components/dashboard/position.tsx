"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isAddress } from "viem";
import { Search } from "lucide-react";
import { cn } from "cn";
import type { PositionData } from "@/lib/pendle/position";
import { EPOCHS_PER_YEAR } from "@/lib/pendle/config";
import { WALLET_KEY } from "@/lib/theme";
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

export function Position({ initialHex }: { initialHex: string }) {
  const [hex, setHex] = useState(initialHex);
  const [inputError, setInputError] = useState<string | null>(null);
  // An address in the URL is looked up after mount, so the page paints first; the section starts in
  // its loading state so there is no idle flash before the fetch begins.
  const fromUrl = HEX40.test(initialHex) && isAddress(`0x${initialHex}`, { strict: false });
  const [state, setState] = useState<State>(fromUrl ? { kind: "loading", address: `0x${initialHex}` } : { kind: "idle" });
  // Whether the address on screen is saved in this browser's localStorage. A lookup typed here is
  // saved; an address that arrived in the URL is not, until the visitor asks. Nothing leaves the device.
  const [remembered, setRemembered] = useState(false);

  // After the page has painted: look up the URL's wallet, or failing that the remembered one.
  useEffect(() => {
    if (fromUrl) {
      void lookup(initialHex, false);
      return;
    }
    const saved = localStorage.getItem(WALLET_KEY);
    if (saved) void restore(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount
  }, []);

  async function restore(saved: string) {
    setHex(saved.replace(/^0x/i, ""));
    setRemembered(true);
    await lookup(saved.replace(/^0x/i, ""), false);
  }

  function remember(address: string) {
    localStorage.setItem(WALLET_KEY, address);
    setRemembered(true);
  }

  function forget() {
    localStorage.removeItem(WALLET_KEY);
    setRemembered(false);
  }

  async function lookup(candidate: string, save = true) {
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
    let res: Response;
    try {
      res = await fetch(`/api/position?address=${address}`);
    } catch (e) {
      setState({ kind: "error", message: `Could not reach the server: ${(e as Error).message}` });
      return;
    }
    const body = (await res.json()) as PositionData | { error: string };
    if (!res.ok || "error" in body) {
      setState({ kind: "error", message: "error" in body ? body.error : `HTTP ${res.status}` });
      return;
    }
    setState({ kind: "result", data: body });
    if (save) remember(body.address);
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
        index="09"
        title="Your position"
        methodId="method-assumptions"
        lede="Paste a wallet address for its holdings, sPENDLE paid per epoch, its own APR including airdrops, and what the boost costs or earns it."
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
          Nothing is fetched until you look up an address. It reads the same contracts as the page plus
          Pendle&apos;s API for accrued rewards and airdrops.
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
      {state.kind === "result" && (
        <>
          <MemoryRow
            address={state.data.address}
            remembered={remembered}
            onRemember={() => remember(state.data.address)}
            onForget={forget}
          />
          <Result data={state.data} />
        </>
      )}
    </section>
  );
}

/** Device memory for the address on screen, and a link that opens straight on it. */
function MemoryRow({
  address,
  remembered,
  onRemember,
  onForget,
}: {
  address: string;
  remembered: boolean;
  onRemember: () => void;
  onForget: () => void;
}) {
  // Built at click time: this row also renders on the server when the address came from the URL.
  const link = () => `${window.location.origin}/?address=${address}`;
  const action = "underline decoration-border underline-offset-4 hover:text-foreground";
  return (
    <div className="-mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {remembered ? (
        <span>
          Remembered on this device.{" "}
          <button type="button" onClick={onForget} className={action}>
            Forget
          </button>
        </span>
      ) : (
        <span>
          <button type="button" onClick={onRemember} className={action}>
            Remember on this device
          </button>{" "}
          to load it next time. Stays in this browser.
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <CopyButton value={link} label="Copy a link that opens on this wallet" className="-ml-1" />
        Copy link to this wallet
      </span>
    </div>
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
          No sPENDLE, cooldown, vePENDLE lock (now or at the snapshot), or rewards recorded by
          Pendle&apos;s API for this address.
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
              tip="Every PENDLE-denominated balance this address has on mainnet, at the live PENDLE quote from Pendle's price API. sPENDLE, unclaimed rewards, locked PENDLE and PENDLE in cooldown are each one PENDLE. Other chains and LP positions are not read."
            />
          </div>
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="sPENDLE"
              value={fmtInt(sPendle.balance + sPendle.unclaimed)}
              usd={usd(sPendle.balance + sPendle.unclaimed)}
              tone="spendle"
              sub={`${fmtInt(sPendle.balance)} in wallet + ${fmtNum(sPendle.unclaimed)} unclaimed, which keep earning`}
              tip="sPENDLE balanceOf this address, plus rewards Pendle's API says it has accrued minus what it has claimed onchain. Unclaimed rewards sit in the distributor but earn for you, so they count toward your reward weight."
            />
            <Stat
              label="Locked"
              value={fmtInt(locked)}
              usd={usd(locked)}
              tone="vependle"
              tip="PENDLE under a live vePENDLE lock for this address, from the contract's position at the latest block. The snapshot figures are the same position at the 29 Jan 2026 block; the boost is computed from those, so extending or adding to the lock since then changes nothing about the boost."
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
              tip="PENDLE this address has unstaked and is waiting out the cooldown on. The sPENDLE was burned when the cooldown started, so this earns nothing; the date is cooldown start + the contract's cooldown period."
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
              sub="liquid, not staked"
              tip="PENDLE balanceOf this address on mainnet. It earns nothing until staked; included in the dollar value held for completeness."
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
                  ? `${fmtMult(lock.multiplierNow)} on the snapshot lock, 1× on ${fmtDate(lock.snapshotExpiry)}; reward weight, not a balance`
                  : "no active boost; reward weight, not a balance"
              }
              tip="Your snapshot lock × (1 + 3 × time remaining ÷ 2 years), using the lock as it stood at the 29 Jan 2026 snapshot. This is the weight your lock carries in each distribution; it falls every day and reaches zero when the snapshot lock expires, even if you have since extended."
            />
          </CardContent>
        </Card>
        <Card size="sm" className="">
          <CardContent>
            <Stat
              label="Reward weight and share"
              value={fmtPct(weight.share, 4)}
              size="lg"
              sub={`${fmtInt(weight.now)} of the eligible total; ≈ ${fmtNum(weight.pendingShare, 1)} sPENDLE of the ${fmtCompact(weight.pendingBuyback)} bought back so far this epoch`}
              tip="Your sPENDLE, unclaimed rewards included, plus your virtual sPENDLE, divided by the protocol's reward-eligible total. Your share of the next distribution if nothing changes."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <Eyebrow tip="What this address has earned from distributions since the snapshot: this page's own estimate from your weight each epoch, and Pendle's record from its API, side by side.">
              Paid so far
            </Eyebrow>
            <Stat
              label="Earned (estimate)"
              value={fmtNum(rewards.earnedEstimate)}
              unit="sPENDLE"
              usd={usd(rewards.earnedEstimate)}
              size="lg"
              sub={`${rewards.epochsWithPosition} epochs with a position; assumes you were active in each`}
              tip="Your weight ÷ eligible total × each distribution, summed. Assumes you were active in every epoch (Pendle requires a governance vote); compare with Pendle's record beside it."
            />
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Stat
                label="Pendle's record"
                value={fmtNum(rewards.apiAccrued)}
                usd={usd(rewards.apiAccrued)}
                sub={`accrued per the Pendle API: ${fmtNum(rewards.claimed)} claimed onchain, ${fmtNum(rewards.unclaimed)} unclaimed (${usd(rewards.unclaimed)})`}
                tip="All-time sPENDLE rewards Pendle's API has recorded for this address. Claimed is what the rewards distributor has paid out to it onchain. If this is below the estimate, the address most likely missed a governance vote in some epoch and forfeited that epoch's rewards."
              />
              <Stat
                label="In-kind airdrops"
                value={fmtUsd(rewards.airdropUsd)}
                sub={`≈ ${fmtNum(rewards.airdropPendle)} PENDLE at each epoch's buyback price, over ${rewards.airdropEpochsCovered} epochs with data`}
                tip="Your share of each epoch's airdrop USD as Pendle's API reports it, using the same reward share as the sPENDLE estimate. Airdrops are paid in the airdropped tokens, not PENDLE; the PENDLE figure converts each epoch's USD at that epoch's buyback price so it can be added to APR."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow
                className="text-spendle"
                tip="sPENDLE earned in an epoch ÷ your principal in that epoch (sPENDLE incl. unclaimed + locked PENDLE) × 26.09. Both sides are PENDLE, so price cancels. The protocol figures beside it are the same formula for a plain staker and for the average locker."
              >
                Your APR
              </Eyebrow>
              <span className="text-[11px] text-muted-foreground">on sPENDLE + locked PENDLE, per year</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Latest, buybacks only"
                value={apr.latestBuyback === null ? "—" : fmtPct(apr.latestBuyback)}
                tone="spendle"
                size="lg"
                sub={`protocol plain ${fmtPct(apr.protocolPlainLatest)}, average locker ${fmtPct(apr.protocolBoostedAvgLatest)}`}
                tip="Your estimated sPENDLE from the most recent distribution ÷ your principal at that block × 26.09. Above the protocol's plain APR means your lock's boost is lifting you; below it means the boost premium others hold is diluting you."
              />
              <Stat
                label="Latest incl. airdrops"
                value={apr.latestTotal === null ? "—" : fmtPct(apr.latestTotal)}
                size="lg"
                sub="airdrops converted to PENDLE at that epoch's buyback price"
                tip="The same APR with your share of that epoch's in-kind airdrops added, converted to PENDLE at the epoch's buyback price. Shown as a dash when Pendle's API has no airdrop figure for the epoch."
              />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Stat
                label="Mean, buybacks only"
                value={apr.meanBuyback === null ? "—" : fmtPct(apr.meanBuyback)}
                sub={`${apr.epochsAveraged} epochs with a position`}
                tip="Arithmetic mean of your per-epoch buyback APRs over every epoch in which you held sPENDLE or a lock. Epochs before you had a position are left out, not counted as zero."
              />
              <Stat
                label="Mean incl. airdrops"
                value={apr.meanTotal === null ? "—" : fmtPct(apr.meanTotal)}
                sub={`${apr.epochsAveragedTotal} of those epochs with airdrop data`}
                tip="The same mean with airdrops included, over only the epochs where Pendle's API reports an airdrop figure. Fewer epochs than the buyback-only mean, so the two are not strictly comparable."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardContent className="flex flex-col gap-5">
            <Eyebrow
              className="text-boost"
              tip="The loyalty boost moves sPENDLE from every 1× unit to snapshot lockers. These figures split that into what your sPENDLE has lost to it and what your lock has gained from it, epoch by epoch, plus the remainder until the boost ends at the latest distribution size."
            >
              What the boost does to you
            </Eyebrow>
            {hasStake && (
              <Stat
                label="Dilution on your sPENDLE"
                value={`−${fmtNum(rewards.dilutionCost)}`}
                unit="sPENDLE so far"
                tone="boost"
                size="lg"
                sub={`shortfall vs everyone at 1×; ≈ ${fmtNum(outlook.remainingDilutionCost)} more by ${fmtDate(outlook.boostEndsAt)} at the latest distribution`}
                tip="For each epoch: what your sPENDLE would have earned if every locked PENDLE counted 1×, minus what it did earn, summed. The remainder projects the same gap day by day to the boost's end, with each epoch paying the latest distribution and protocol sPENDLE held flat."
              />
            )}
            {lock && (rewards.premiumEarned > 0 || hasBoost) && (
              <Stat
                label="Premium on your lock"
                value={`+${fmtNum(rewards.premiumEarned)}`}
                unit="sPENDLE so far"
                tone="vependle"
                size="lg"
                sub={`above a 1× count of your lock; ≈ ${fmtNum(outlook.remainingPremium)} more before your boost ends`}
                tip="For each epoch: (your virtual sPENDLE − your snapshot-locked PENDLE) ÷ the eligible total × the distribution, summed. The part of your rewards that exists only because of the multiplier. The remainder projects it to your snapshot lock's expiry at the latest distribution size."
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
                <Eyebrow tip="A day-by-day projection of your buyback APR from today to the last snapshot unlock. Your weight is your sPENDLE plus your decaying virtual sPENDLE; when your own lock expires its PENDLE is assumed restaked at 1×. The protocol side holds sPENDLE supply flat and lets only the snapshot boost decay.">
                  Your APR until boost ends
                </Eyebrow>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Position held as-is, protocol sPENDLE flat, each epoch paying the latest{" "}
                  {fmtInt(outlook.latestDistribution)} sPENDLE; your unlocked PENDLE assumed restaked at
                  1×. Buybacks only.
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
                  tipLabel="Today"
                  tip="Your projected APR at today's weights if the next distribution equalled the latest one."
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
                    tipLabel="Your unlock"
                    tip="Your projected APR on the day your live lock expires, with its PENDLE restaked as sPENDLE at 1×. Any remaining snapshot boost on your position ends at the snapshot expiry, which may differ from this date."
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
                  tipLabel="Boost ends"
                  tip="Your projected APR once every snapshot lock has expired and no virtual sPENDLE remains, so every unit counts 1×. If your own lock has unlocked by then it is assumed restaked and this matches the protocol's plain APR; if it runs past this date, its PENDLE is still in your principal but earns nothing, so the figure sits lower."
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
            <Eyebrow tip="One row per distribution, newest first: your sPENDLE (wallet + unclaimed) and lock at that block, your multiplier and share of the eligible total, the sPENDLE that share earned, your airdrop share converted at the buyback price, the price the buyback paid, and your APR for the epoch with and without airdrops.">
              Epoch by epoch
            </Eyebrow>
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
          <details className="px-4 pt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none list-none underline decoration-border underline-offset-4 hover:text-foreground [&::-webkit-details-marker]:hidden">
              Column notes
            </summary>
            <p className="mt-2 leading-relaxed">
              APR: sPENDLE earned ÷ (your sPENDLE + your locked PENDLE) × {EPY}, token terms. Your sPENDLE:
              wallet balance plus rewards accrued and not yet claimed, just before each distribution;
              unclaimed rewards keep earning. Airdrop → PENDLE: Pendle&apos;s API reports each epoch&apos;s
              in-kind airdrops in USD with no valuation timestamp; your share is converted at that
              epoch&apos;s realised buyback price (USDT the buyback contract sent ÷ PENDLE it received
              between distributions, from its token transfers; every PENDLE inflow counts) and added to
              sPENDLE earned. The API covers the last 12 epochs; earlier rows show &ldquo;no data&rdquo;
              and are left out of the airdrop-inclusive mean. Held balances above use the live quote (
              {fmtUsdPrice(pendleUsd)}); APR does not.
            </p>
          </details>
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
