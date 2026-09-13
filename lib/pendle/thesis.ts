import { fmtCompact, fmtDate, fmtInt, fmtMult, fmtPct, fmtUsd, fmtUsdCompact } from "@/lib/format";
import type { TrackerData } from "./tracker";

/**
 * One bullish signal, evaluated against a stated test. Signals are pure functions of the cached
 * dataset, so they move when a distribution lands or a fee epoch closes.
 */
export type Unit = "pendle" | "usd" | "pct" | "mult";

/**
 * The numbers a signal's meter is drawn from. `compare` is a value against a benchmark (two bars);
 * `share` is a fraction against a threshold (one track with a tick); `series` is a schedule over
 * time (a small area chart).
 */
export type Metric =
  | {
      kind: "compare";
      value: number;
      valueLabel: string;
      benchmark: number;
      benchmarkLabel: string;
      unit: Unit;
      /** Which way is "good": true when the value should exceed the benchmark. */
      higherIsBetter: boolean;
    }
  | { kind: "share"; value: number; threshold: number }
  | {
      kind: "series";
      points: { t: number; v: number }[];
      /** Dashed verticals with a caption, between the start and end labels. */
      marks: { t: number; label: string }[];
      startLabel: string;
      endLabel: string;
    };

export type Signal = {
  id: string;
  title: string;
  /** Headline figure, formatted. */
  value: string;
  /** What the headline figure is, in a few words, when the meter's own labels do not say. */
  caption?: string;
  /** The numbers behind it and where they come from. */
  detail: string;
  /** The rule this signal is judged on, stated so a reader can disagree with it. */
  test: string;
  passing: boolean;
  metric: Metric;
  /** One line shown on the card face, if the meter leaves something important unsaid. */
  note?: string;
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
    title: "Buybacks vs emissions",
    value: fmtMult(ratio, 1),
    caption: "PENDLE bought back per PENDLE emitted, per epoch",
    metric: {
      kind: "compare",
      value: latest.amount,
      valueLabel: "Bought back, latest distribution",
      benchmark: emissionsPerEpoch,
      benchmarkLabel: "Emitted per 14-day epoch, AIM all chains",
      unit: "pendle",
      higherIsBetter: true,
    },
    detail: `Latest distribution: ${fmtInt(latest.amount)} PENDLE bought for ${fmtUsd(latest.usdtSpent)} USDT of fees and paid to stakers. AIM assigns ${fmtCompact(revenue.aim.pendle)} PENDLE a week, ${fmtCompact(emissionsPerEpoch)} per 14-day epoch, all chains and streams.`,
    note: supplyNote,
    test: "PENDLE bought back in the latest distribution > 2 × the weekly AIM assignment",
    passing: ratio > 1,
  };

  // 2. Eligible sPENDLE trend (all sPENDLE, unclaimed rewards included).
  const first = distributions[0];
  const prev = distributions[distributions.length - 1];
  const stakedGrowth = change(sPendle.eligible, first.eligibleSPendle);
  const exitShare = sPendle.cooldownQueue / sPendle.supply;
  const staking: Signal = {
    id: "staking-rising",
    title: "Eligible sPENDLE growth",
    value: signedPct(stakedGrowth),
    caption: `eligible sPENDLE since ${fmtDate(first.timestamp, { day: undefined })}`,
    metric: {
      kind: "series",
      points: [
        ...distributions.map((d) => ({ t: d.timestamp, v: d.eligibleSPendle })),
        { t: data.block.timestamp, v: sPendle.eligible },
      ],
      marks: [],
      startLabel: `${fmtCompact(first.eligibleSPendle)}, ${fmtDate(first.timestamp, { year: undefined })}`,
      endLabel: `${fmtCompact(sPendle.eligible)} today`,
    },
    detail: `Eligible sPENDLE is ${fmtCompact(sPendle.eligible)}, from ${fmtCompact(first.eligibleSPendle)} at the first distribution (${fmtDate(first.timestamp)}) and ${fmtCompact(prev.eligibleSPendle)} at the latest. ${fmtPct(exitShare, 1)} of sPENDLE is in the cooldown queue.`,
    test: "eligible sPENDLE today > eligible sPENDLE at the latest distribution",
    passing: sPendle.eligible > prev.eligibleSPendle,
  };

  // 3. Share of supply staked or locked.
  const illiquid = (sPendle.supply + vePendle.pendleHeld) / pendleSupply.now;
  const locked: Signal = {
    id: "illiquid-share",
    title: "Supply staked or locked",
    value: fmtPct(illiquid, 1),
    caption: "of PENDLE supply",
    metric: { kind: "share", value: illiquid, threshold: 0.25 },
    detail: `${fmtCompact(sPendle.supply)} sPENDLE + ${fmtCompact(vePendle.pendleHeld)} PENDLE in the vePENDLE contract, of ${fmtCompact(pendleSupply.now)} total supply. ${fmtCompact(vePendle.activeLocked)} of the locked PENDLE is under an active lock.`,
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
    metric: {
      kind: "compare",
      value: latestEpoch.fees,
      valueLabel: `Epoch from ${fmtDate(latestEpoch.start, { year: undefined })}`,
      benchmark: priorFees,
      benchmarkLabel: "Mean of the four before",
      unit: "usd",
      higherIsBetter: true,
    },
    detail: `${fmtUsd(latestEpoch.fees)} gross in the epoch from ${fmtDate(latestEpoch.start)}, against a ${fmtUsd(priorFees)} mean over the four before it. Single epochs are lumpy: DefiLlama books fees on treasury arrival.`,
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
    metric: {
      kind: "compare",
      value: latestClosed.buybackFunded,
      valueLabel: `Epoch from ${fmtDate(latestClosed.start, { year: undefined })}`,
      benchmark: priorFunded,
      benchmarkLabel: "Mean of the four before",
      unit: "usd",
      higherIsBetter: true,
    },
    detail: `${fmtUsd(latestClosed.buybackFunded)} USDT funded for the epoch from ${fmtDate(latestClosed.start)}, against a ${fmtUsd(priorFunded)} mean over the four before it.${open ? ` The ${fmtDate(open.start)} epoch has ${fmtUsd(open.buybackFunded)} so far, window open.` : ""}`,
    test: "USDT funded for the latest closed epoch > mean of the prior four",
    passing: latestClosed.buybackFunded > priorFunded,
  };

  // 6. LP emissions trend (Ethereum gauge controller).
  const emitting = complete.filter((e) => e.emittedPendle > 0);
  const latestEmit = emitting[emitting.length - 1];
  const priorEmit = mean(prior(emitting, 4).map((e) => e.emittedPendle));
  const emissions: Signal = {
    id: "emissions-falling",
    title: "LP emissions, Ethereum",
    value: signedPct(change(latestEmit.emittedPendle, priorEmit)),
    caption: "lower is better",
    metric: {
      kind: "compare",
      value: latestEmit.emittedPendle,
      valueLabel: `Epoch from ${fmtDate(latestEmit.start, { year: undefined })}`,
      benchmark: priorEmit,
      benchmarkLabel: "Mean of the four before",
      unit: "pendle",
      higherIsBetter: false,
    },
    detail: `${fmtInt(latestEmit.emittedPendle)} PENDLE to Ethereum LPs in the epoch from ${fmtDate(latestEmit.start)}, against ${fmtInt(priorEmit)} mean over the four before it and ${fmtInt(emitting[0].emittedPendle)} in the first epoch after the snapshot. Ethereum gauge, Performance stream only.`,
    test: "LP emissions from the Ethereum gauge in the latest complete epoch < mean of the prior four",
    passing: latestEmit.emittedPendle < priorEmit,
  };

  // 7. Plain staking APR vs its trailing mean.
  const apr: Signal = {
    id: "apr-improving",
    title: "Plain APR, latest",
    value: fmtPct(latest.aprPlain),
    metric: {
      kind: "compare",
      value: latest.aprPlain,
      valueLabel: `Distribution ${latest.epoch}`,
      benchmark: data.yield.trailing.aprPlain,
      benchmarkLabel: `Trailing ${data.yield.trailing.epochs}-epoch mean`,
      unit: "pct",
      higherIsBetter: true,
    },
    detail: `${fmtPct(latest.aprPlain)} on the latest distribution (${fmtDate(latest.timestamp)}), against a ${fmtPct(data.yield.trailing.aprPlain)} mean over the last ${data.yield.trailing.epochs} epochs. Token terms.`,
    test: "latest plain APR > trailing 6-epoch mean",
    passing: latest.aprPlain > data.yield.trailing.aprPlain,
  };

  // 8. Boost dilution fades on a fixed schedule.
  const yearAhead = projection.find((p) => p.t >= data.block.timestamp + 365 * 86_400) ?? projection[projection.length - 1];
  const end = projection[projection.length - 1];
  const fading: Signal = {
    id: "dilution-fading",
    title: "Dilution fades on schedule",
    value: fmtPct(dilution.premiumShare, 1),
    caption: "of each distribution goes to the boost today",
    metric: {
      kind: "series",
      points: projection.filter((_, i) => i % 7 === 0 || i === projection.length - 1).map((p) => ({ t: p.t, v: p.dilutionFlat })),
      marks: [{ t: yearAhead.t, label: `${fmtPct(yearAhead.dilutionFlat, 0)} in a year` }],
      startLabel: `${fmtPct(dilution.premiumShare, 0)} today`,
      endLabel: `0 on ${fmtDate(loyalty.expiresAt, { year: undefined })}`,
    },
    detail: `The boost takes ${fmtPct(dilution.premiumShare, 1)} of each distribution today, ${fmtPct(yearAhead.dilutionFlat, 1)} in a year, nothing after ${fmtDate(loyalty.expiresAt)}. Plain APR goes from ${fmtPct(latest.aprPlain)} to ${fmtPct(end.aprPlainFlat)} if the distribution stays flat and unlocking PENDLE is not restaked.`,
    test: "boost premium share > 0 and its end date is in the future",
    passing: dilution.premiumShare > 0 && loyalty.expiresAt > data.block.timestamp,
  };

  // 9. Policy honoured: the share of revenue that actually reaches the buyback contract.
  const v = data.valuation;
  const payout: Signal = {
    id: "payout-honoured",
    title: "Revenue reaching stakers",
    value: fmtPct(v.payoutRatio, 0),
    caption: "of revenue funded to buybacks; policy says up to 80%",
    metric: { kind: "share", value: v.payoutRatio, threshold: 0.7 },
    detail: `Over the last ${v.payoutEpochs} closed funding windows the buyback contract received ${fmtPct(v.payoutRatio, 0)} of DefiLlama revenue as USDT. At ${fmtUsdCompact(v.buybackAnnual)} a year that is a ${fmtPct(v.buybackYield)} buyback yield on a ${fmtUsdCompact(v.marketCap)} market cap, ${fmtPct(v.netBuybackYield)} after AIM emissions.`,
    test: "USDT funded to the buyback contract ≥ 70% of DefiLlama revenue over the last four closed epochs",
    passing: v.payoutRatio >= 0.7,
  };

  const signals = [staking, locked, fees, funding, emissions, apr, fading, payout];
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
