import { getAddress, type Address } from "viem";
import { fetchSnapshotSchedule, fetchUserEpochStates, fetchUserState } from "./chain";
import { EPOCHS_PER_YEAR, EPOCH_SECONDS, MAX_LOCK_TIME, WEEK } from "./config";
import { lastExpiry, loyaltyAt, toTokens, type LockBucket } from "./model";
import { fetchApiEpochs, fetchApiUserSPendleAccrued, fetchPendleUsd, type ApiEpoch } from "./pendle-api";
import { annualise, getTrackerData, type Distribution } from "./tracker";

export type EpochRow = {
  epoch: number;
  timestamp: number;
  txHash: string;
  distributed: number;
  /** Wallet sPENDLE just before the distribution. */
  sPendleBalance: number;
  /** Rewards accrued but not yet claimed at that point; they earn like wallet sPENDLE. */
  sPendleUnclaimed: number;
  locked: number;
  virtual: number;
  multiplier: number;
  share: number;
  sPendleEarned: number;
  premiumEarned: number;
  dilutionCost: number;
  /** Realised buyback price for the epoch: USDT spent ÷ PENDLE bought. */
  execPrice: number;
  /** Epoch-wide in-kind airdrops in USD as Pendle reports them; null where the API has no record. */
  airdropUsd: number | null;
  airdropTokens: string[];
  userAirdropUsd: number | null;
  userAirdropPendle: number | null;
  principal: number;
  aprBuyback: number | null;
  aprTotal: number | null;
};

export type PositionData = {
  address: Address;
  block: { number: number; timestamp: number };
  empty: boolean;
  /** Live PENDLE/USD from Pendle's asset-price feed. */
  pendleUsd: number;
  sPendle: {
    /** sPENDLE in the wallet. */
    balance: number;
    /** Rewards accrued (per Pendle) and not yet claimed; they earn like wallet sPENDLE. */
    unclaimed: number;
    cooldownAmount: number;
    cooldownReadyAt: number | null;
    walletPendle: number;
  };
  lock: {
    amount: number;
    expiry: number;
    snapshotAmount: number;
    snapshotExpiry: number;
    virtualNow: number;
    multiplierNow: number;
    boostActive: boolean;
  } | null;
  weight: { now: number; share: number; pendingBuyback: number; pendingShare: number };
  rewards: {
    earnedEstimate: number;
    apiAccrued: number;
    claimed: number;
    unclaimed: number;
    airdropUsd: number;
    airdropPendle: number;
    premiumEarned: number;
    dilutionCost: number;
    epochsWithPosition: number;
    airdropEpochsCovered: number;
  };
  apr: {
    latestBuyback: number | null;
    latestTotal: number | null;
    meanBuyback: number | null;
    meanTotal: number | null;
    epochsAveraged: number;
    epochsAveragedTotal: number;
    protocolPlainLatest: number;
    protocolBoostedAvgLatest: number;
  };
  outlook: {
    aprNow: number | null;
    aprAtUnlockRestaked: number | null;
    aprAfterBoost: number | null;
    unlockAt: number | null;
    boostEndsAt: number;
    remainingDilutionCost: number;
    remainingPremium: number;
    latestDistribution: number;
  };
  projection: { t: number; apr: number }[];
  epochs: EpochRow[];
};

const DAY = 86_400n;

function userVirtualAt(amount: bigint, expiry: bigint, t: bigint): bigint {
  if (expiry <= t) return 0n;
  return amount + (3n * amount * (expiry - t)) / MAX_LOCK_TIME;
}

function apiEpochFor(epochs: ApiEpoch[], t: number): ApiEpoch | undefined {
  return epochs.find((e) => e.start + EPOCH_SECONDS <= t && t < e.start + 2 * EPOCH_SECONDS);
}

/**
 * A wallet's slice of the dashboard. Protocol-wide inputs (distributions, buyback windows, live
 * balances, the block they were read at) come from the cached tracker dataset, so a lookup only
 * pays for the wallet's own reads: one multicall now, two transfer-log queries for its history,
 * and Pendle's API for its accrued rewards.
 */
export async function getPosition(input: string): Promise<PositionData> {
  const address = getAddress(input);
  const [data, snapshot, apiEpochs, pendleUsd] = await Promise.all([
    getTrackerData(),
    fetchSnapshotSchedule(),
    fetchApiEpochs(),
    fetchPendleUsd(),
  ]);
  const atBlock = BigInt(data.block.number);
  const [user, apiAccrued] = await Promise.all([
    fetchUserState(address, atBlock),
    fetchApiUserSPendleAccrued(address),
  ]);
  const distributions = data.distributions;
  const states = await fetchUserEpochStates(
    address,
    distributions.map((d) => BigInt(d.blockNumber)),
    { block: atBlock, balance: user.sPendleBalance, claimed: user.claimedSPendle },
  );

  const now = BigInt(data.block.timestamp);
  // Unclaimed rewards keep earning, so a holder's eligible sPENDLE is wallet balance plus rewards
  // accrued so far and not yet claimed. Accrued-so-far is this estimate's own running total.
  let accruedSoFar = 0;
  const epochs = distributions.map((d, k): EpochRow => {
    const t = BigInt(d.timestamp);
    const wallet = toTokens(states[k].balance);
    const unclaimed = Math.max(0, accruedSoFar - toTokens(states[k].claimed));
    const bal = wallet + unclaimed;
    const lockedAtEpoch = user.snapshotLockExpiry > t ? toTokens(user.snapshotLockAmount) : 0;
    const virtual = toTokens(userVirtualAt(user.snapshotLockAmount, user.snapshotLockExpiry, t));
    const share = (bal + virtual) / d.eligibleTotal;
    const sPendleEarned = share * d.amount;
    const premiumEarned = ((virtual - lockedAtEpoch) / d.eligibleTotal) * d.amount;
    const dilutionCost =
      bal * d.amount * (1 / (d.eligibleSPendle + d.lockedSnapshot) - 1 / d.eligibleTotal);
    const execPrice = d.usdtSpent / d.pendleBought;
    const api = apiEpochFor(apiEpochs, d.timestamp);
    const airdropUsd = api ? api.airdropUsd : null;
    const userAirdropUsd = airdropUsd === null ? null : share * airdropUsd;
    const userAirdropPendle = userAirdropUsd === null ? null : userAirdropUsd / execPrice;
    const principal = bal + lockedAtEpoch;
    const aprBuyback = principal > 0 ? annualise(sPendleEarned, principal) : null;
    const aprTotal =
      principal > 0 && userAirdropPendle !== null
        ? annualise(sPendleEarned + userAirdropPendle, principal)
        : null;
    accruedSoFar += sPendleEarned;
    return {
      epoch: d.epoch,
      timestamp: d.timestamp,
      txHash: d.txHash,
      distributed: d.amount,
      sPendleBalance: wallet,
      sPendleUnclaimed: unclaimed,
      locked: lockedAtEpoch,
      virtual,
      multiplier: lockedAtEpoch > 0 ? virtual / lockedAtEpoch : 0,
      share,
      sPendleEarned,
      premiumEarned,
      dilutionCost,
      execPrice,
      airdropUsd,
      airdropTokens: api ? api.airdrops.map((a) => a.token) : [],
      userAirdropUsd,
      userAirdropPendle,
      principal,
      aprBuyback,
      aprTotal,
    };
  });

  const latestDist = distributions[distributions.length - 1];
  const latestRow = epochs[epochs.length - 1];
  const withBuyback = epochs.filter((e) => e.aprBuyback !== null);
  const withTotal = epochs.filter((e) => e.aprTotal !== null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

  const walletBalance = toTokens(user.sPendleBalance);
  const claimed = toTokens(user.claimedSPendle);
  const accrued = toTokens(apiAccrued);
  const unclaimedNow = Math.max(0, accrued - claimed);
  // Eligible sPENDLE for this wallet: what it holds plus what it has earned and not yet claimed.
  const balance = walletBalance + unclaimedNow;
  const lockedNow = user.lockExpiry > now ? toTokens(user.lockAmount) : 0;
  const virtualNow = toTokens(userVirtualAt(user.snapshotLockAmount, user.snapshotLockExpiry, now));
  const hasLock = user.snapshotLockAmount > 0n || user.lockAmount > 0n;

  const eligibleSPendle = data.sPendle.eligible;
  const protocolNow = loyaltyAt(snapshot, now);
  const rewardEligible = eligibleSPendle + toTokens(protocolNow.virtual);
  const weightNow = balance + virtualNow;
  const share = weightNow / rewardEligible;
  const pendingBuyback = data.yield.pendingBuyback;

  const boostEndsAt = lastExpiry(snapshot);
  const outlook = buildOutlook({
    snapshot,
    now,
    boostEndsAt,
    eligibleSPendle,
    latestAmount: latestDist.amount,
    balance,
    lockedNow,
    liveExpiry: user.lockExpiry,
    snapAmount: user.snapshotLockAmount,
    snapExpiry: user.snapshotLockExpiry,
  });

  return {
    address,
    block: { number: data.block.number, timestamp: data.block.timestamp },
    empty: walletBalance === 0 && user.cooldownAmount === 0n && !hasLock && accrued === 0,
    pendleUsd,
    sPendle: {
      balance: walletBalance,
      unclaimed: unclaimedNow,
      cooldownAmount: toTokens(user.cooldownAmount),
      cooldownReadyAt:
        user.cooldownAmount > 0n ? Number(user.cooldownStart) + data.sPendle.cooldownDays * 86_400 : null,
      walletPendle: toTokens(user.pendleBalance),
    },
    lock: hasLock
      ? {
          amount: toTokens(user.lockAmount),
          expiry: Number(user.lockExpiry),
          snapshotAmount: toTokens(user.snapshotLockAmount),
          snapshotExpiry: Number(user.snapshotLockExpiry),
          virtualNow,
          multiplierNow: user.snapshotLockAmount > 0n ? virtualNow / toTokens(user.snapshotLockAmount) : 0,
          boostActive: user.snapshotLockExpiry > now,
        }
      : null,
    weight: { now: weightNow, share, pendingBuyback, pendingShare: share * pendingBuyback },
    rewards: {
      earnedEstimate: epochs.reduce((s, e) => s + e.sPendleEarned, 0),
      apiAccrued: accrued,
      claimed,
      unclaimed: accrued - claimed,
      airdropUsd: epochs.reduce((s, e) => s + (e.userAirdropUsd ?? 0), 0),
      airdropPendle: epochs.reduce((s, e) => s + (e.userAirdropPendle ?? 0), 0),
      premiumEarned: epochs.reduce((s, e) => s + e.premiumEarned, 0),
      dilutionCost: epochs.reduce((s, e) => s + e.dilutionCost, 0),
      epochsWithPosition: withBuyback.length,
      airdropEpochsCovered: epochs.filter((e) => e.airdropUsd !== null).length,
    },
    apr: {
      latestBuyback: latestRow.aprBuyback,
      latestTotal: latestRow.aprTotal,
      meanBuyback: mean(withBuyback.map((e) => e.aprBuyback!)),
      meanTotal: mean(withTotal.map((e) => e.aprTotal!)),
      epochsAveraged: withBuyback.length,
      epochsAveragedTotal: withTotal.length,
      protocolPlainLatest: latestDist.aprPlain,
      protocolBoostedAvgLatest: latestDist.aprBoostedAvg,
    },
    outlook: {
      aprNow: outlook.aprNow,
      aprAtUnlockRestaked: outlook.aprAtUnlockRestaked,
      aprAfterBoost: outlook.aprAfterBoost,
      unlockAt: outlook.unlockAt,
      boostEndsAt: Number(boostEndsAt),
      remainingDilutionCost: outlook.remainingDilutionCost,
      remainingPremium: outlook.remainingPremium,
      latestDistribution: latestDist.amount,
    },
    projection: outlook.projection,
    epochs,
  };
}

function buildOutlook(p: {
  snapshot: LockBucket[];
  now: bigint;
  boostEndsAt: bigint;
  eligibleSPendle: number;
  latestAmount: number;
  balance: number;
  lockedNow: number;
  liveExpiry: bigint;
  snapAmount: bigint;
  snapExpiry: bigint;
}) {
  const principal = p.balance + p.lockedNow;
  const end = p.boostEndsAt + WEEK;
  const perDay = p.latestAmount / (EPOCH_SECONDS / 86_400);
  const projection: { t: number; apr: number }[] = [];
  let remainingDilutionCost = 0;
  let remainingPremium = 0;
  let aprAtUnlockRestaked: number | null = null;

  const aprAt = (t: bigint) => {
    const s = loyaltyAt(p.snapshot, t);
    const restaked = p.lockedNow > 0 && p.liveExpiry <= t ? p.lockedNow : 0;
    const userVirtual = toTokens(userVirtualAt(p.snapAmount, p.snapExpiry, t));
    const weight = p.balance + userVirtual + restaked;
    const total = p.eligibleSPendle + restaked + toTokens(s.virtual);
    return { apr: (p.latestAmount * EPOCHS_PER_YEAR * weight) / total / principal, s, userVirtual };
  };

  for (let t = p.now; t <= end; t += DAY) {
    const { apr, s, userVirtual } = aprAt(t);
    if (principal > 0) projection.push({ t: Number(t), apr });
    const V = toTokens(s.virtual);
    const L = toTokens(s.locked);
    remainingDilutionCost +=
      p.balance * perDay * (1 / (p.eligibleSPendle + L) - 1 / (p.eligibleSPendle + V));
    const lockedSnap = p.snapExpiry > t ? toTokens(p.snapAmount) : 0;
    remainingPremium += ((userVirtual - lockedSnap) * perDay) / (p.eligibleSPendle + V);
  }
  if (principal > 0 && p.lockedNow > 0 && p.liveExpiry > p.now && p.liveExpiry <= end) {
    aprAtUnlockRestaked = aprAt(p.liveExpiry).apr;
  }
  return {
    aprNow: principal > 0 ? aprAt(p.now).apr : null,
    aprAtUnlockRestaked,
    aprAfterBoost: principal > 0 ? aprAt(end).apr : null,
    unlockAt: p.lockedNow > 0 ? Number(p.liveExpiry) : null,
    remainingDilutionCost,
    remainingPremium,
    projection,
  };
}

export type { Distribution };
