import { fmtCompact, fmtDate, fmtInt, fmtMult, fmtPct, fmtUsd } from "@/lib/format";
import type { TrackerData } from "./tracker";

/**
 * One bullish signal, evaluated against a stated test. Signals are pure functions of the cached
 * dataset, so they move when a distribution lands or a fee epoch closes.
 */
export type Signal = {
  id: string;
  title: string;
  /** Headline figure, formatted. */
  value: string;
  /** The numbers behind it and where they come from. */
  detail: string;
  /** The rule this signal is judged on, stated so a reader can disagree with it. */
  test: string;
  passing: boolean;
};

export type Thesis = {
  /** Always first: PENDLE bought back vs PENDLE emitted. */
  headline: Signal;
  passing: Signal[];
  failing: Signal[];
  evaluated: { distributionEpoch: number; distributionAt: number; feeEpochStart: number };
};

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const change = (now: number, base: number) => now / base - 1;
const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${fmtPct(Math.abs(x), 0)}`;

/** The last `n` items before the final one; at least one is required. */
function prior<T>(xs: T[], n: number): T[] {
  const p = xs.slice(Math.max(0, xs.length - 1 - n), -1);
  if (p.length === 0) throw new Error("Thesis needs at least two data points to compare");
  return p;
}

export function buildThesis(data: TrackerData): Thesis {
  const { revenue, distributions, sPendle, vePendle, pendleSupply, dilution, projection, loyalty } = data;
  const latest = data.yield.latest;
  const complete = revenue.epochs.filter((e) => e.complete);
  if (complete.length < 2) throw new Error("Thesis needs at least two complete fee epochs");

  // 1. Buybacks vs emissions, in PENDLE.
  const emissionsPerEpoch = revenue.aim.pendle * 2;
  const ratio = latest.amount / emissionsPerEpoch;
  const supplyDelta = pendleSupply.now - pendleSupply.atSnapshot;
  const supplyNote =
    Math.abs(supplyDelta) < 1
      ? `Supply is ${fmtCompact(pendleSupply.now)} PENDLE, unchanged since the 29 Jan snapshot; nothing is minted.`
      : `Supply is ${fmtCompact(pendleSupply.now)} PENDLE, ${supplyDelta > 0 ? "up" : "down"} ${fmtCompact(Math.abs(supplyDelta))} since the 29 Jan snapshot.`;
  const headline: Signal = {
    id: "ultra-sound",
    title: "Buybacks outrun emissions",
    value: fmtMult(ratio, 1),
    detail: `The buyback is the sPENDLE yield: the latest distribution bought ${fmtInt(latest.amount)} PENDLE on the market for ${fmtUsd(latest.usdtSpent)} USDT of protocol fees and paid it to stakers. AIM currently assigns ${fmtCompact(revenue.aim.pendle)} PENDLE a week, ${fmtCompact(emissionsPerEpoch)} per 14-day epoch, across every chain and stream. Since 29 Jan, ${fmtCompact(data.yield.totalDistributed)} PENDLE has been bought back for ${fmtUsd(data.yield.totalBuybackUsd)}. ${supplyNote}`,
    test: "PENDLE bought back in the latest distribution > 2 × the weekly AIM assignment",
    passing: ratio > 1,
  };

  // 2. Reward-eligible sPENDLE trend.
  const first = distributions[0];
  const prev = distributions[distributions.length - 1];
  const stakedGrowth = change(sPendle.eligible, first.eligibleSPendle);
  const exitShare = sPendle.cooldownQueue / sPendle.supply;
  const staking: Signal = {
    id: "staking-rising",
    title: "Eligible sPENDLE growth",
    value: signedPct(stakedGrowth),
    detail: `Reward-eligible sPENDLE is ${fmtCompact(sPendle.eligible)}, from ${fmtCompact(first.eligibleSPendle)} at the first distribution (${fmtDate(first.timestamp)}) and ${fmtCompact(prev.eligibleSPendle)} at the latest. ${fmtPct(exitShare, 1)} of sPENDLE is in the 14-day cooldown queue.`,
    test: "eligible sPENDLE today > eligible sPENDLE at the latest distribution",
    passing: sPendle.eligible > prev.eligibleSPendle,
  };

  // 3. Share of supply staked or locked.
  const illiquid = (sPendle.supply + vePendle.pendleHeld) / pendleSupply.now;
  const locked: Signal = {
    id: "illiquid-share",
    title: "Supply staked or locked",
    value: fmtPct(illiquid, 1),
    detail: `${fmtCompact(sPendle.supply)} sPENDLE plus ${fmtCompact(vePendle.pendleHeld)} PENDLE in the vePENDLE escrow, of ${fmtCompact(pendleSupply.now)} total supply. sPENDLE leaves through a 14-day cooldown or a 5% fee; ${fmtCompact(vePendle.activeLocked)} of the escrow is still under lock, most of it until January 2028.`,
    test: "> 25% of PENDLE supply is staked or locked",
    passing: illiquid > 0.25,
  };

  // 4. Gross fees trend, latest complete epoch vs the four before it.
  const latestEpoch = complete[complete.length - 1];
  const priorFees = mean(prior(complete, 4).map((e) => e.fees));
  const fees: Signal = {
    id: "fees-rising",
    title: "Gross fees vs 4-epoch mean",
    value: signedPct(change(latestEpoch.fees, priorFees)),
    detail: `Gross fees were ${fmtUsd(latestEpoch.fees)} in the epoch from ${fmtDate(latestEpoch.start)}, against a ${fmtUsd(priorFees)} mean over the four epochs before it. DefiLlama books a fee when the tokens reach Pendle's treasury, so single epochs are lumpy.`,
    test: "latest complete epoch gross fees > mean of the prior four",
    passing: latestEpoch.fees > priorFees,
  };

  // 5. Realised buyback funding trend, closed funding windows only.
  const closed = revenue.epochs.filter((e) => e.buybackWindowClosed && e.buybackFunded > 0);
  if (closed.length < 2) throw new Error("Thesis needs at least two closed buyback funding windows");
  const latestClosed = closed[closed.length - 1];
  const priorFunded = mean(prior(closed, 4).map((e) => e.buybackFunded));
  const open = revenue.epochs.find((e) => !e.buybackWindowClosed && e.buybackFunded > 0);
  const funding: Signal = {
    id: "funding-rising",
    title: "Buyback funding, last closed",
    value: signedPct(change(latestClosed.buybackFunded, priorFunded)),
    detail: `${fmtUsd(latestClosed.buybackFunded)} USDT reached the buyback contract for the epoch from ${fmtDate(latestClosed.start)}, against a ${fmtUsd(priorFunded)} mean over the four before it.${open ? ` The ${fmtDate(open.start)} epoch has ${fmtUsd(open.buybackFunded)} so far with its window still open.` : ""}`,
    test: "USDT funded for the latest closed epoch > mean of the prior four",
    passing: latestClosed.buybackFunded > priorFunded,
  };

  // 6. Ethereum gauge emissions trend.
  const emitting = complete.filter((e) => e.emittedPendle > 0);
  const latestEmit = emitting[emitting.length - 1];
  const priorEmit = mean(prior(emitting, 4).map((e) => e.emittedPendle));
  const emissions: Signal = {
    id: "emissions-falling",
    title: "ETH gauge emissions",
    value: signedPct(change(latestEmit.emittedPendle, priorEmit)),
    detail: `The Ethereum gauge controller paid ${fmtInt(latestEmit.emittedPendle)} PENDLE to markets in the epoch from ${fmtDate(latestEmit.start)}, against ${fmtInt(priorEmit)} mean over the four before it and ${fmtInt(emitting[0].emittedPendle)} in the first epoch after the snapshot. Performance stream on Ethereum only; limit-order and other chains' PENDLE is not in this figure.`,
    test: "ETH gauge outflow in the latest complete epoch < mean of the prior four",
    passing: latestEmit.emittedPendle < priorEmit,
  };

  // 7. Plain staking APR vs its trailing mean.
  const apr: Signal = {
    id: "apr-improving",
    title: "Plain APR, latest",
    value: fmtPct(latest.aprPlain),
    detail: `Plain sPENDLE APR was ${fmtPct(latest.aprPlain)} on the latest distribution (${fmtDate(latest.timestamp)}), against a ${fmtPct(data.yield.trailing.aprPlain)} mean over the last ${data.yield.trailing.epochs} epochs. Token terms; PENDLE price cancels out.`,
    test: "latest plain APR > trailing 6-epoch mean",
    passing: latest.aprPlain > data.yield.trailing.aprPlain,
  };

  // 8. Boost dilution fades on a fixed schedule.
  const yearAhead = projection.find((p) => p.t >= data.block.timestamp + 365 * 86_400) ?? projection[projection.length - 1];
  const end = projection[projection.length - 1];
  const fading: Signal = {
    id: "dilution-fading",
    title: "Dilution fades on schedule",
    value: `${fmtPct(dilution.premiumShare, 1)} → 0`,
    detail: `The loyalty boost takes ${fmtPct(dilution.premiumShare, 1)} of every distribution today, ${fmtPct(yearAhead.dilutionFlat, 1)} a year from now, and nothing after ${fmtDate(loyalty.expiresAt)}. Holding the latest distribution flat, plain APR rises from ${fmtPct(latest.aprPlain)} to ${fmtPct(end.aprPlainFlat)} with no change in fees.`,
    test: "boost premium share > 0 and its end date is in the future",
    passing: dilution.premiumShare > 0 && loyalty.expiresAt > data.block.timestamp,
  };

  const signals = [staking, locked, fees, funding, emissions, apr, fading];
  return {
    headline,
    passing: signals.filter((s) => s.passing),
    failing: signals.filter((s) => !s.passing),
    evaluated: {
      distributionEpoch: latest.epoch,
      distributionAt: latest.timestamp,
      feeEpochStart: latestEpoch.start,
    },
  };
}
