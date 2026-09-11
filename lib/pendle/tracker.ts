import {
  fetchDistributions,
  fetchLiveState,
  fetchSnapshotSchedule,
  type RawDistribution,
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

export type Distribution = {
  epoch: number;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  /** sPENDLE handed to the Merkle distributor. */
  amount: number;
  /** Reward-eligible sPENDLE the block before: supply minus unclaimed rewards parked in the distributor. */
  eligibleSPendle: number;
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

export type TrackerData = {
  fetchedAt: number;
  rpcUrl: string;
  block: { number: number; timestamp: number };
  addresses: typeof ADDRESSES;
  sPendle: {
    supply: number;
    pendleHeld: number;
    cooldownQueue: number;
    unclaimedInDistributor: number;
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
  yield: {
    latest: Distribution;
    trailing: { epochs: number; aprPlain: number; aprBoostedAvg: number; from: number; to: number };
    aprMaxBoosted: number;
    aprNoBoost: number;
    aprSolo: number;
    pendingBuyback: number;
    nextDistributionEta: number;
    totalDistributed: number;
  };
  dilution: {
    lockerShare: number;
    stakerShare: number;
    premiumShare: number;
    aprHaircut: number;
  };
  distributions: Distribution[];
  projection: ProjectionPoint[];
  unlocks: UnlockWeek[];
};

const TRAILING_EPOCHS = 6;

export function annualise(amount: number, base: number) {
  return (amount / base) * EPOCHS_PER_YEAR;
}

export function buildDistributions(raw: RawDistribution[], snapshot: LockBucket[]): Distribution[] {
  return raw
    .sort((a, b) => Number(a.blockNumber - b.blockNumber))
    .map((d, i) => {
      const v = loyaltyAt(snapshot, d.timestamp);
      const amount = toTokens(d.amount);
      const eligible = toTokens(d.supplyBefore - d.distributorBefore);
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
        eligibleSPendle: eligible,
        virtualSPendle: virtualThen,
        lockedSnapshot: lockedThen,
        eligibleTotal: total,
        aprPlain,
        avgMultiplier,
        aprBoostedAvg: aprPlain * avgMultiplier,
      };
    });
}

export async function getTrackerData(): Promise<TrackerData> {
  const [live, snapshot] = await Promise.all([fetchLiveState(), fetchSnapshotSchedule()]);
  const raw = await fetchDistributions(live.blockNumber);
  if (raw.length === 0) throw new Error("No sPENDLE reward distributions found onchain");

  const now = live.timestamp;
  const loyaltyNow = loyaltyAt(snapshot, now);
  const loyaltyAtSnapshot = loyaltyAt(snapshot, SNAPSHOT_TS);
  const liveNow = loyaltyAt(live.liveSchedule, now);
  const expiresAt = lastExpiry(snapshot);

  const supply = toTokens(live.sPendleSupply);
  const unclaimed = toTokens(live.sPendleInDistributor);
  const eligibleSPendle = supply - unclaimed;
  const virtual = toTokens(loyaltyNow.virtual);
  const locked = toTokens(loyaltyNow.locked);
  const premium = virtual - locked;
  const eligibleTotal = eligibleSPendle + virtual;

  const distributions = buildDistributions(raw, snapshot);

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

  return {
    fetchedAt: Date.now(),
    rpcUrl: RPC_URL,
    block: { number: Number(live.blockNumber), timestamp: Number(now) },
    addresses: ADDRESSES,
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
    },
    dilution: {
      lockerShare: virtual / eligibleTotal,
      stakerShare: eligibleSPendle / eligibleTotal,
      premiumShare: premium / eligibleTotal,
      aprHaircut: 1 - (eligibleSPendle + locked) / eligibleTotal,
    },
    distributions,
    projection,
    unlocks,
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
