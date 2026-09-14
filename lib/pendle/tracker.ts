import { unstable_cache } from "next/cache";
import {
  fetchBuybackWindows,
  fetchDistributions,
  fetchLiveState,
  fetchSnapshotPendleSupply,
  fetchSnapshotSchedule,
  type BuybackWindow,
  type RawDistribution,
  fetchMigration,
  type Migration,
  fetchFlows,
  type Flows,
  fetchKnownWallets,
  type KnownWallet,
  fetchLockPositions,
  type LockPosition,
  type Move,
} from "./chain";
import {
  ADDRESSES,
  EPOCHS_PER_YEAR,
  EPOCH_SECONDS,
  MAX_LOCK_TIME,
  RPC_URL,
  SNAPSHOT_BLOCK,
  SNAPSHOT_TS,
  WEEK,
} from "./config";
import { lastExpiry, loyaltyAt, multiplierFor, toTokens, type LockBucket } from "./model";
import { fetchPendleUsd, fetchPendleUsdHistory } from "./pendle-api";
import { getRevenueData, withExecutedBuybacks, type RevenueData } from "./revenue";
import { buildValuation, type Valuation } from "./valuation";

export type Distribution = {
  epoch: number;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  /** sPENDLE handed to the Merkle distributor: the PENDLE bought back for this epoch, staked 1:1. */
  amount: number;
  /** USDT the buyback contract spent on swaps between the previous distribution and this one (USD). */
  usdtSpent: number;
  /** PENDLE the buyback contract received in that window; every inflow, not only swap output. */
  pendleBought: number;
  /** The TWAP's USDT outflows in that window, timed by interpolating blocks between the window's bounds. */
  buys: { t: number; usd: number }[];
  /** Reward-eligible sPENDLE the block before: every sPENDLE, wallet-held or unclaimed in the distributor. */
  eligibleSPendle: number;
  /** Of which rewards not yet claimed, sitting in the distributor. */
  unclaimedSPendle: number;
  virtualSPendle: number;
  /** Snapshot-eligible PENDLE still locked at that block (the 1× part of virtual sPENDLE). */
  lockedSnapshot: number;
  eligibleTotal: number;
  aprPlain: number;
  avgMultiplier: number;
  aprBoostedAvg: number;
};

export type ProjectionPoint = {
  t: number;
  locked: number;
  virtual: number;
  premium: number;
  avgMultiplier: number;
  /** Reward share captured by the boost premium, sPENDLE supply held flat. */
  dilutionFlat: number;
  /** Same, assuming every unlocked PENDLE is immediately restaked as sPENDLE. */
  dilutionRestake: number;
  stakerShareFlat: number;
  stakerShareRestake: number;
  /** Plain-staker APR if every future epoch paid the latest distribution amount. */
  aprPlainFlat: number;
};

export type UnlockWeek = { expiry: number; amount: number; cumulativeRemaining: number };

/** How the PENDLE supply splits between places it can and cannot trade from. */
export type SupplySplit = {
  staked: number;
  locked: number;
  /** Pendle's multisigs and treasury. */
  pendle: number;
  investors: number;
  exchanges: number;
  bridged: number;
  /** Buyback contract and gauge controller inventory. */
  contracts: number;
  other: number;
  total: number;
};

export type Locker = { label: string; address: string; amount: number; expiry: number; share: number };
export type TopLock = LockPosition & { label?: string };

export type TrackerData = {
  fetchedAt: number;
  rpcUrl: string;
  block: { number: number; timestamp: number };
  addresses: typeof ADDRESSES;
  /** PENDLE token supply, now and at the loyalty snapshot block; equal means nothing was minted. */
  pendleSupply: { now: number; atSnapshot: number };
  sPendle: {
    supply: number;
    pendleHeld: number;
    cooldownQueue: number;
    /** Rewards distributed but not yet claimed, held by the distributor; they keep earning for their owners. */
    unclaimedInDistributor: number;
    /** Reward-eligible sPENDLE: every sPENDLE, wallet-held or unclaimed. Equals supply. */
    eligible: number;
    cooldownDays: number;
    instantFeePct: number;
  };
  vePendle: {
    pendleHeld: number;
    activeLocked: number;
    expiredUnwithdrawn: number;
    veBalance: number;
    snapshotLocked: number;
    lockedOutsideSnapshot: number;
    lastLiveExpiry: number;
  };
  loyalty: {
    virtual: number;
    premium: number;
    avgMultiplier: number;
    maxMultiplier: number;
    maxRemainingDays: number;
    expiresAt: number;
    snapshot: { timestamp: number; block: number; locked: number; virtual: number; avgMultiplier: number };
    decayPerDay: number;
  };
  combined: { hubTotalStaked: number; rewardEligible: number };
  /** Live PENDLE/USD from Pendle's asset-price feed. */
  pendleUsd: number;
  yield: {
    latest: Distribution;
    trailing: { epochs: number; aprPlain: number; aprBoostedAvg: number; from: number; to: number };
    aprMaxBoosted: number;
    aprNoBoost: number;
    aprSolo: number;
    pendingBuyback: number;
    nextDistributionEta: number;
    totalDistributed: number;
    /** USDT spent buying everything distributed so far. */
    totalBuybackUsd: number;
  };
  dilution: {
    lockerShare: number;
    stakerShare: number;
    premiumShare: number;
    aprHaircut: number;
  };
  distributions: Distribution[];
  /** vePENDLE → sPENDLE since the snapshot: weekly withdrawals, restakes, and balances. */
  migration: Migration;
  projection: ProjectionPoint[];
  /** Snapshot schedule: what defines the boost. */
  unlocks: UnlockWeek[];
  /** Live schedule: when locked PENDLE actually becomes withdrawable. Differs where locks changed after the snapshot. */
  liveUnlocks: UnlockWeek[];
  /** Largest live lock positions by wallet. */
  topLocks: TopLock[];
  /** The liquid-locker protocols' vePENDLE positions and their share of active locked PENDLE. */
  lockers: Locker[];
  revenue: RevenueData;
  /** sPENDLE stake and unstake flows since the snapshot. */
  flows: Flows;
  /** Largest stakes, cooldowns, instant unstakes, and lock withdrawals in the last 30 days. */
  moves: Move[];
  holders: { wallets: KnownWallet[]; split: SupplySplit };
  valuation: Valuation;
};

const TRAILING_EPOCHS = 6;

export function annualise(amount: number, base: number) {
  return (amount / base) * EPOCHS_PER_YEAR;
}

export function buildDistributions(
  raw: RawDistribution[],
  windows: BuybackWindow[],
  snapshot: LockBucket[],
): Distribution[] {
  if (windows.length !== raw.length) {
    throw new Error(`Expected ${raw.length} buyback windows, got ${windows.length}`);
  }
  return raw.map((d, i) => {
      const w = windows[i];
      const from = i > 0 ? raw[i - 1] : { blockNumber: SNAPSHOT_BLOCK, timestamp: SNAPSHOT_TS };
      const span = Number(d.blockNumber - from.blockNumber);
      const tsOf = (block: bigint) =>
        Number(from.timestamp) + (Number(block - from.blockNumber) / span) * Number(d.timestamp - from.timestamp);
      const v = loyaltyAt(snapshot, d.timestamp);
      const amount = toTokens(d.amount);
      const eligible = toTokens(d.supplyBefore);
      if (!Number.isFinite(eligible) || eligible <= 0) {
        throw new Error(`Distribution ${d.txHash}: eligible sPENDLE at block ${d.blockNumber - 1n} is ${eligible}`);
      }
      const virtualThen = toTokens(v.virtual);
      const lockedThen = toTokens(v.locked);
      const total = eligible + virtualThen;
      const aprPlain = annualise(amount, total);
      const avgMultiplier = virtualThen / lockedThen;
      return {
        epoch: i + 1,
        timestamp: Number(d.timestamp),
        blockNumber: Number(d.blockNumber),
        txHash: d.txHash,
        amount,
        usdtSpent: Number(w.usdtSpent) / 1e6,
        pendleBought: toTokens(w.pendleBought),
        buys: w.usdtOut.map((o) => ({ t: Math.round(tsOf(o.block)), usd: Number(o.usdt) / 1e6 })),
        eligibleSPendle: eligible,
        unclaimedSPendle: toTokens(d.distributorBefore),
        virtualSPendle: virtualThen,
        lockedSnapshot: lockedThen,
        eligibleTotal: total,
        aprPlain,
        avgMultiplier,
        aprBoostedAvg: aprPlain * avgMultiplier,
      };
    });
}

/** Cache tag for the dashboard dataset; `updateTag(TRACKER_TAG)` forces the next read to hit the chain. */
export const TRACKER_TAG = "tracker";
/** How long a computed dataset is served before it is recomputed in the background. */
export const TRACKER_MAX_AGE_SECONDS = 300;

/**
 * A cold computation is ~230 weighted RPC units through the 14-unit/s pacer plus six HTTP fetches,
 * so 20–30 s. Vercel starts most requests on a fresh instance, where the in-process memo in
 * `chain.ts` is empty, so the finished dataset is kept in Next's data cache instead: it survives
 * across instances, is served in milliseconds, and once older than `TRACKER_MAX_AGE_SECONDS` the
 * stale copy is still returned while one recomputation runs in the background.
 */
export const getTrackerData = unstable_cache(computeTrackerData, ["tracker-data"], {
  revalidate: TRACKER_MAX_AGE_SECONDS,
  tags: [TRACKER_TAG],
});

async function computeTrackerData(): Promise<TrackerData> {
  const [live, snapshot, snapshotSupply, pendleUsd, revenueBase, migration, flows] = await Promise.all([
    fetchLiveState(),
    fetchSnapshotSchedule(),
    fetchSnapshotPendleSupply(),
    fetchPendleUsd(),
    getRevenueData(),
    fetchMigration(),
    fetchFlows(),
  ]);
  const [rawUnsorted, wallets, lockPositions, priceHistory] = await Promise.all([
    fetchDistributions(live.blockNumber),
    fetchKnownWallets(live.blockNumber),
    fetchLockPositions(live.blockNumber),
    fetchPendleUsdHistory(Number(live.timestamp)),
  ]);
  const raw = rawUnsorted.sort((a, b) => Number(a.blockNumber - b.blockNumber));
  if (raw.length === 0) throw new Error("No sPENDLE reward distributions found onchain");
  // Buyback execution between consecutive distributions: (previous distribution block, this one].
  const windows = await fetchBuybackWindows([SNAPSHOT_BLOCK, ...raw.map((d) => d.blockNumber)]);

  const now = live.timestamp;
  const loyaltyNow = loyaltyAt(snapshot, now);
  const loyaltyAtSnapshot = loyaltyAt(snapshot, SNAPSHOT_TS);
  const liveNow = loyaltyAt(live.liveSchedule, now);
  const expiresAt = lastExpiry(snapshot);

  const supply = toTokens(live.sPendleSupply);
  const unclaimed = toTokens(live.sPendleInDistributor);
  // Unclaimed rewards keep earning for their owners, so every sPENDLE is reward-eligible.
  const eligibleSPendle = supply;
  const virtual = toTokens(loyaltyNow.virtual);
  const locked = toTokens(loyaltyNow.locked);
  const premium = virtual - locked;
  const eligibleTotal = eligibleSPendle + virtual;

  const distributions = buildDistributions(raw, windows, snapshot);
  const revenue = withExecutedBuybacks(
    revenueBase,
    distributions.map((d) => ({ distributedAt: d.timestamp, pendle: d.amount, usd: d.usdtSpent })),
  );

  const latest = distributions[distributions.length - 1];
  const trailingSet = distributions.slice(-TRAILING_EPOCHS);
  const trailingPlain =
    (trailingSet.reduce((s, d) => s + d.aprPlain, 0) / trailingSet.length);
  const trailingBoosted =
    (trailingSet.reduce((s, d) => s + d.aprBoostedAvg, 0) / trailingSet.length);

  const maxRemaining = expiresAt - now;
  const avgMultiplier = virtual / locked;

  const projection = buildProjection(snapshot, now, expiresAt, eligibleSPendle, latest.amount);
  const unlocks = buildUnlocks(snapshot, now);
  const liveUnlocks = buildUnlocks(live.liveSchedule, now);

  const labelOf = new Map(wallets.map((w) => [w.address.toLowerCase(), w.label]));
  const topLocks: TopLock[] = lockPositions.slice(0, 10).map((l) => ({ ...l, label: labelOf.get(l.user.toLowerCase()) }));
  const activeLocked = toTokens(liveNow.locked);
  const lockers: Locker[] = wallets
    .filter((w) => w.category === "locker")
    .map((w) => ({ label: w.label, address: w.address, amount: w.locked, expiry: w.lockExpiry, share: w.locked / activeLocked }))
    .sort((a, b) => b.amount - a.amount);

  const sumCat = (c: KnownWallet["category"]) => wallets.filter((w) => w.category === c).reduce((s, w) => s + w.pendle, 0);
  const totalSupply = toTokens(live.pendleTotalSupply);
  const split: SupplySplit = {
    staked: toTokens(live.pendleInSPendle),
    locked: toTokens(live.pendleInVePendle),
    pendle: sumCat("pendle"),
    investors: sumCat("investor"),
    exchanges: sumCat("exchange"),
    bridged: sumCat("bridge"),
    contracts: sumCat("contract"),
    other: 0,
    total: totalSupply,
  };
  split.other = totalSupply - (split.staked + split.locked + split.pendle + split.investors + split.exchanges + split.bridged + split.contracts);
  if (split.other < 0) throw new Error(`Supply split exceeds total supply by ${-split.other} PENDLE`);

  const moves = [...flows.largeMoves, ...migration.largeWithdrawals].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const valuation = buildValuation({
    price: pendleUsd,
    totalSupply,
    pendleHeld: split.pendle + split.contracts,
    revenue,
    distributions,
    priceHistory,
    now: Number(live.timestamp),
  });

  return {
    fetchedAt: Date.now(),
    rpcUrl: RPC_URL,
    block: { number: Number(live.blockNumber), timestamp: Number(now) },
    addresses: ADDRESSES,
    pendleSupply: { now: toTokens(live.pendleTotalSupply), atSnapshot: toTokens(snapshotSupply) },
    sPendle: {
      supply,
      pendleHeld: toTokens(live.pendleInSPendle),
      cooldownQueue: toTokens(live.pendleInSPendle - live.sPendleSupply),
      unclaimedInDistributor: unclaimed,
      eligible: eligibleSPendle,
      cooldownDays: live.cooldownDuration / 86_400,
      instantFeePct: Number(live.instantUnstakeFeeRate) / 1e16,
    },
    vePendle: {
      pendleHeld: toTokens(live.pendleInVePendle),
      activeLocked: toTokens(liveNow.locked),
      expiredUnwithdrawn: toTokens(live.pendleInVePendle - liveNow.locked),
      veBalance: toTokens(liveNow.veBalance),
      snapshotLocked: locked,
      lockedOutsideSnapshot: toTokens(liveNow.locked - loyaltyNow.locked),
      lastLiveExpiry: Number(lastExpiry(live.liveSchedule)),
    },
    loyalty: {
      virtual,
      premium,
      avgMultiplier,
      maxMultiplier: multiplierFor(maxRemaining),
      maxRemainingDays: Number(maxRemaining) / 86_400,
      expiresAt: Number(expiresAt),
      snapshot: {
        timestamp: Number(SNAPSHOT_TS),
        block: Number(SNAPSHOT_BLOCK),
        locked: toTokens(loyaltyAtSnapshot.locked),
        virtual: toTokens(loyaltyAtSnapshot.virtual),
        avgMultiplier: toTokens(loyaltyAtSnapshot.virtual) / toTokens(loyaltyAtSnapshot.locked),
      },
      decayPerDay: (3 * locked * 86_400) / Number(MAX_LOCK_TIME),
    },
    combined: {
      hubTotalStaked: supply + toTokens(live.pendleInVePendle),
      rewardEligible: eligibleTotal,
    },
    pendleUsd,
    yield: {
      latest,
      trailing: {
        epochs: trailingSet.length,
        aprPlain: trailingPlain,
        aprBoostedAvg: trailingBoosted,
        from: trailingSet[0].timestamp,
        to: latest.timestamp,
      },
      aprMaxBoosted: latest.aprPlain * multiplierFor(maxRemaining),
      aprNoBoost: annualise(latest.amount, eligibleSPendle + locked),
      aprSolo: annualise(latest.amount, eligibleSPendle),
      pendingBuyback: toTokens(live.pendleInBuyback),
      nextDistributionEta: latest.timestamp + EPOCH_SECONDS,
      totalDistributed: distributions.reduce((s, d) => s + d.amount, 0),
      totalBuybackUsd: distributions.reduce((s, d) => s + d.usdtSpent, 0),
    },
    dilution: {
      lockerShare: virtual / eligibleTotal,
      stakerShare: eligibleSPendle / eligibleTotal,
      premiumShare: premium / eligibleTotal,
      aprHaircut: 1 - (eligibleSPendle + locked) / eligibleTotal,
    },
    distributions,
    migration,
    projection,
    unlocks,
    liveUnlocks,
    topLocks,
    lockers,
    revenue,
    flows,
    moves,
    holders: { wallets, split },
    valuation,
  };
}

function buildProjection(
  schedule: LockBucket[],
  now: bigint,
  expiresAt: bigint,
  sPendle: number,
  latestAmount: number,
): ProjectionPoint[] {
  const lockedNow = toTokens(loyaltyAt(schedule, now).locked);
  const end = expiresAt + WEEK;
  const step = 86_400n;
  const times: bigint[] = [];
  for (let t = now; t < end; t += step) times.push(t);
  times.push(end);
  return times.map((t) => {
    const s = loyaltyAt(schedule, t);
    const locked = toTokens(s.locked);
    const virtual = toTokens(s.virtual);
    const premium = virtual - locked;
    const restaked = sPendle + (lockedNow - locked);
    const totalFlat = sPendle + virtual;
    const totalRestake = restaked + virtual;
    return {
      t: Number(t),
      locked,
      virtual,
      premium,
      avgMultiplier: locked > 0 ? virtual / locked : 0,
      dilutionFlat: premium / totalFlat,
      dilutionRestake: premium / totalRestake,
      stakerShareFlat: sPendle / totalFlat,
      stakerShareRestake: restaked / totalRestake,
      aprPlainFlat: annualise(latestAmount, totalFlat),
    };
  });
}

function buildUnlocks(schedule: LockBucket[], now: bigint): UnlockWeek[] {
  const future = schedule.filter((b) => b.expiry > now).sort((a, b) => Number(a.expiry - b.expiry));
  let remaining = future.reduce((s, b) => s + toTokens(b.slope * MAX_LOCK_TIME), 0);
  return future.map((b) => {
    const amount = toTokens(b.slope * MAX_LOCK_TIME);
    remaining -= amount;
    return { expiry: Number(b.expiry), amount, cumulativeRemaining: remaining };
  });
}
