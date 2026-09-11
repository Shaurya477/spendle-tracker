import type { Address, Hex } from "viem";
import {
  erc20Abi,
  merkleDistributorAbi,
  stakedPendleAbi,
  transferEvent,
  votingEscrowAbi,
} from "./abis";
import { client } from "./client";
import {
  ADDRESSES,
  LIVE_WEEKS,
  SNAPSHOT_BLOCK,
  SNAPSHOT_TS,
  SNAPSHOT_WEEKS,
  WEEK,
  EPOCH_SECONDS,
  FEE_EPOCH_ORIGIN,
} from "./config";
import type { LockBucket } from "./model";

const { pendle, sPendle, vePendle, buyback, merkleDistributor, usdt, gaugeController } = ADDRESSES;

/**
 * Memoised immutable chain reads. Kept on globalThis because Next bundles the page and
 * /api/position separately, and a module-level cache would be fetched once per bundle.
 */
type ChainCache = {
  snapshotSchedule?: Promise<LockBucket[]>;
  snapshotPendleSupply?: Promise<bigint>;
  distributions: Map<Hex, Promise<RawDistribution>>;
  windows: Map<string, Promise<BuybackWindow>>;
};
const cache: ChainCache = ((globalThis as typeof globalThis & { __spendleChainCache?: ChainCache }).__spendleChainCache ??= {
  distributions: new Map(),
  windows: new Map(),
});

/** Cache a pending read under `key`; a rejected read is dropped again so the next load re-reads instead of replaying the failure. */
function memo<K, V>(map: Map<K, Promise<V>>, key: K, read: () => Promise<V>): Promise<V> {
  let entry = map.get(key);
  if (!entry) {
    entry = read();
    map.set(key, entry);
    entry.catch(() => map.delete(key));
  }
  return entry;
}

async function readSchedule(firstWeek: bigint, weeks: number, blockNumber?: bigint) {
  const expiries = Array.from({ length: weeks }, (_, i) => firstWeek + BigInt(i) * WEEK);
  // batchSize 0: all ~110 slopeChanges in one eth_call (~50 KB) instead of viem's default four 1 KB chunks.
  const slopes = await client.multicall({
    allowFailure: false,
    batchSize: 0,
    blockNumber,
    contracts: expiries.map((w) => ({
      address: vePendle,
      abi: votingEscrowAbi,
      functionName: "slopeChanges",
      args: [w],
    })),
  });
  const schedule: LockBucket[] = [];
  for (let i = 0; i < expiries.length; i++) {
    if (slopes[i] > 0n) schedule.push({ expiry: expiries[i], slope: slopes[i] });
  }
  return schedule;
}

/** vePENDLE expiry schedule as it stood at the loyalty-bonus snapshot block. Immutable, so memoised for the process lifetime. */
export function fetchSnapshotSchedule() {
  if (!cache.snapshotSchedule) {
    cache.snapshotSchedule = readSchedule(SNAPSHOT_TS + WEEK, SNAPSHOT_WEEKS, SNAPSHOT_BLOCK);
    cache.snapshotSchedule.catch(() => {
      cache.snapshotSchedule = undefined;
    });
  }
  return cache.snapshotSchedule;
}

/** PENDLE `totalSupply()` at the snapshot block. Immutable, memoised for the process lifetime. */
export function fetchSnapshotPendleSupply() {
  if (!cache.snapshotPendleSupply) {
    cache.snapshotPendleSupply = client.readContract({
      address: pendle,
      abi: erc20Abi,
      functionName: "totalSupply",
      blockNumber: SNAPSHOT_BLOCK,
    });
    cache.snapshotPendleSupply.catch(() => {
      cache.snapshotPendleSupply = undefined;
    });
  }
  return cache.snapshotPendleSupply;
}

export type LiveState = {
  blockNumber: bigint;
  timestamp: bigint;
  /** PENDLE `totalSupply()` at the latest block. */
  pendleTotalSupply: bigint;
  sPendleSupply: bigint;
  pendleInSPendle: bigint;
  sPendleInDistributor: bigint;
  pendleInVePendle: bigint;
  pendleInBuyback: bigint;
  cooldownDuration: number;
  instantUnstakeFeeRate: bigint;
  liveSchedule: LockBucket[];
};

export async function fetchLiveState(): Promise<LiveState> {
  const block = await client.getBlock({ blockTag: "latest" });
  const currentWeekStart = block.timestamp - (block.timestamp % WEEK);
  const [values, liveSchedule] = await Promise.all([
    client.multicall({
      allowFailure: false,
      blockNumber: block.number,
      contracts: [
        { address: pendle, abi: erc20Abi, functionName: "totalSupply" },
        { address: sPendle, abi: stakedPendleAbi, functionName: "totalSupply" },
        { address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [sPendle] },
        { address: sPendle, abi: stakedPendleAbi, functionName: "balanceOf", args: [merkleDistributor] },
        { address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [vePendle] },
        { address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [buyback] },
        { address: sPendle, abi: stakedPendleAbi, functionName: "cooldownDuration" },
        { address: sPendle, abi: stakedPendleAbi, functionName: "instantUnstakeFeeRate" },
      ],
    }),
    readSchedule(currentWeekStart + WEEK, LIVE_WEEKS, block.number),
  ]);
  const [
    pendleTotalSupply,
    sPendleSupply,
    pendleInSPendle,
    sPendleInDistributor,
    pendleInVePendle,
    pendleInBuyback,
    cooldownDuration,
    instantUnstakeFeeRate,
  ] = values;
  return {
    blockNumber: block.number,
    timestamp: block.timestamp,
    pendleTotalSupply,
    sPendleSupply,
    pendleInSPendle,
    sPendleInDistributor,
    pendleInVePendle,
    pendleInBuyback,
    cooldownDuration,
    instantUnstakeFeeRate,
    liveSchedule,
  };
}

export type RawDistribution = {
  blockNumber: bigint;
  timestamp: bigint;
  txHash: Hex;
  /** PENDLE staked by the buyback contract and forwarded to the Merkle distributor as sPENDLE (wei). */
  amount: bigint;
  /** sPENDLE supply the block before the distribution landed (wei). */
  supplyBefore: bigint;
  /** Unclaimed sPENDLE sitting in the Merkle distributor the block before (wei). */
  distributorBefore: bigint;
};

/**
 * Every bi-weekly reward distribution: the buyback contract stakes its accumulated
 * PENDLE into sPENDLE and hands the minted sPENDLE to the Merkle distributor in one tx.
 * The PENDLE `Transfer(buyback → sPENDLE)` inside that tx is the distribution amount.
 */
export async function fetchDistributions(toBlock: bigint): Promise<RawDistribution[]> {
  const logs = await client.getLogs({
    address: pendle,
    event: transferEvent,
    args: { from: buyback, to: sPendle },
    fromBlock: SNAPSHOT_BLOCK,
    toBlock,
  });
  return Promise.all(
    logs.map((log) =>
      memo(cache.distributions, log.transactionHash, async () => {
        const before = log.blockNumber - 1n;
        const [block, [supplyBefore, distributorBefore]] = await Promise.all([
          client.getBlock({ blockNumber: log.blockNumber }),
          client.multicall({
            allowFailure: false,
            blockNumber: before,
            contracts: [
              { address: sPendle, abi: stakedPendleAbi, functionName: "totalSupply" },
              { address: sPendle, abi: stakedPendleAbi, functionName: "balanceOf", args: [merkleDistributor] },
            ],
          }),
        ]);
        return {
          blockNumber: log.blockNumber,
          timestamp: block.timestamp,
          txHash: log.transactionHash,
          amount: log.args.value!,
          supplyBefore,
          distributorBefore,
        };
      }),
    ),
  );
}

export type BuybackWindow = {
  /** USDT the buyback contract sent out in the window (6 decimals). */
  usdtSpent: bigint;
  /** PENDLE the buyback contract received in the window (wei): every inflow, not only swap output. */
  pendleBought: bigint;
};

/**
 * Buyback execution per block window (`bounds[k]`, `bounds[k+1]`]: hourly USDT → PENDLE TWAP swaps
 * through Pendle's router. `usdtSpent / pendleBought` is the realised PENDLE price for the epoch
 * whose rewards were distributed at the window's upper bound. Closed windows never change, so each
 * is memoised; the windows not yet cached are read with two `eth_getLogs` spanning all of them
 * (one per token) and split by block number, rather than two per window.
 */
export function fetchBuybackWindows(bounds: bigint[]): Promise<BuybackWindow[]> {
  const keys = bounds.slice(1).map((upTo, i) => `${bounds[i]}-${upTo}`);
  const missing = keys.flatMap((k, i) => (cache.windows.has(k) ? [] : [i]));
  if (missing.length > 0) {
    const range = { fromBlock: bounds[missing[0]] + 1n, toBlock: bounds[missing[missing.length - 1] + 1] };
    const logs = Promise.all([
      client.getLogs({ address: usdt, event: transferEvent, args: { from: buyback }, ...range }),
      client.getLogs({ address: pendle, event: transferEvent, args: { to: buyback }, ...range }),
    ]);
    for (const i of missing) {
      const after = bounds[i];
      const upTo = bounds[i + 1];
      memo(cache.windows, keys[i], () =>
        logs.then(([usdtOut, pendleIn]) => {
          const inWindow = (l: { blockNumber: bigint }) => l.blockNumber > after && l.blockNumber <= upTo;
          return {
            usdtSpent: usdtOut.filter(inWindow).reduce((s, l) => s + l.args.value!, 0n),
            pendleBought: pendleIn.filter(inWindow).reduce((s, l) => s + l.args.value!, 0n),
          };
        }),
      );
    }
  }
  return Promise.all(keys.map((k) => cache.windows.get(k)!));
}

export type BuybackFunding = { timestamp: number; usdt: bigint };

/**
 * Every USDT `Transfer` into the buyback contract since the snapshot: the realised buyback budget,
 * as opposed to the 80% policy share of DefiLlama revenue. Pendle's fee wallets fund the contract
 * around each fee epoch's end (observed 0.3 days before to 3.3 days after), then the hourly TWAP
 * swaps spend it. Each transfer's timestamp is read from its block (one 1-unit `getBlock` per
 * distinct block, ~56 so far), not interpolated.
 */
export async function fetchBuybackFunding(): Promise<BuybackFunding[]> {
  const logs = await client.getLogs({
    address: usdt,
    event: transferEvent,
    args: { to: buyback },
    fromBlock: SNAPSHOT_BLOCK,
    toBlock: "latest",
  });
  const blocks = [...new Set(logs.map((l) => l.blockNumber))];
  const timestamps = new Map(
    await Promise.all(
      blocks.map(async (blockNumber) => [blockNumber, (await client.getBlock({ blockNumber })).timestamp] as const),
    ),
  );
  return logs.map((log) => ({ timestamp: Number(timestamps.get(log.blockNumber)!), usdt: log.args.value! }));
}

export type UserState = {
  sPendleBalance: bigint;
  cooldownStart: bigint;
  cooldownAmount: bigint;
  pendleBalance: bigint;
  lockAmount: bigint;
  lockExpiry: bigint;
  snapshotLockAmount: bigint;
  snapshotLockExpiry: bigint;
  claimedSPendle: bigint;
};

export async function fetchUserState(user: Address, blockNumber: bigint): Promise<UserState> {
  const [live, [snapshotLock]] = await Promise.all([
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: [
        { address: sPendle, abi: stakedPendleAbi, functionName: "balanceOf", args: [user] },
        { address: sPendle, abi: stakedPendleAbi, functionName: "userCooldown", args: [user] },
        { address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [user] },
        { address: vePendle, abi: votingEscrowAbi, functionName: "positionData", args: [user] },
        { address: merkleDistributor, abi: merkleDistributorAbi, functionName: "claimed", args: [sPendle, user] },
      ],
    }),
    client.multicall({
      allowFailure: false,
      blockNumber: SNAPSHOT_BLOCK,
      contracts: [{ address: vePendle, abi: votingEscrowAbi, functionName: "positionData", args: [user] }],
    }),
  ]);
  const [sPendleBalance, [cooldownStart, cooldownAmount], pendleBalance, [lockAmount, lockExpiry], claimedSPendle] = live;
  return {
    sPendleBalance,
    cooldownStart: BigInt(cooldownStart),
    cooldownAmount: BigInt(cooldownAmount),
    pendleBalance,
    lockAmount,
    lockExpiry,
    snapshotLockAmount: snapshotLock[0],
    snapshotLockExpiry: snapshotLock[1],
    claimedSPendle,
  };
}

/**
 * PENDLE leaving the Ethereum gauge controller since the snapshot. The controller carries only
 * AIM's Performance stream (TVL + fee) to Ethereum markets; the limit-order and co-incentive
 * streams are paid from other wallets and are not in this figure.
 * AIM does not mint — supply is flat — so spend is inventory: start balance + inflows − end
 * balance over each 14-day fee epoch. Epoch boundaries are blocks interpolated linearly between
 * the snapshot and the latest block, so each boundary can be off by a few hundred blocks; fine
 * for 14-day sums. Outbound `getLogs` on this range exceed the RPC body limit; inflows are rare
 * (a handful of top-ups) and fit in one call.
 */
export async function fetchGaugePendleOutflow(): Promise<{
  spent: { timestamp: number; amount: bigint }[];
  gaugePendle: number;
}> {
  const latest = await client.getBlock({ blockTag: "latest" });
  const inLogs = await client.getLogs({
    address: pendle,
    event: transferEvent,
    args: { to: gaugeController },
    fromBlock: SNAPSHOT_BLOCK,
    toBlock: latest.number,
  });
  const dt = Number(latest.timestamp - SNAPSHOT_TS) / Number(latest.number - SNAPSHOT_BLOCK);
  const tsOf = (blockNumber: bigint) => Number(SNAPSHOT_TS) + Number(blockNumber - SNAPSHOT_BLOCK) * dt;
  const blockAt = (ts: number) => {
    const b = SNAPSHOT_BLOCK + BigInt(Math.round((ts - Number(SNAPSHOT_TS)) / dt));
    if (b < SNAPSHOT_BLOCK) return SNAPSHOT_BLOCK;
    if (b > latest.number) return latest.number;
    return b;
  };

  const bounds: number[] = [];
  let t = FEE_EPOCH_ORIGIN + Math.floor((Number(SNAPSHOT_TS) - FEE_EPOCH_ORIGIN) / EPOCH_SECONDS) * EPOCH_SECONDS;
  const now = Number(latest.timestamp);
  while (t <= now) {
    bounds.push(t);
    t += EPOCH_SECONDS;
  }
  bounds.push(now);

  const bals = await Promise.all(
    bounds.map((ts) =>
      client.readContract({
        address: pendle,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [gaugeController],
        blockNumber: blockAt(ts),
      }),
    ),
  );

  const spent: { timestamp: number; amount: bigint }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    let inflows = 0n;
    for (const l of inLogs) {
      const ts = tsOf(l.blockNumber);
      if (ts > start && ts <= end) inflows += l.args.value!;
    }
    const out = bals[i] + inflows - bals[i + 1];
    if (out > 0n) spent.push({ timestamp: start, amount: out });
  }
  return { spent, gaugePendle: Number(bals[bals.length - 1]) / 1e18 };
}

/** The user's sPENDLE balance the block before each distribution landed. */
export function fetchUserEpochBalances(user: Address, blocks: bigint[]): Promise<bigint[]> {
  return Promise.all(
    blocks.map((b) =>
      client.readContract({
        address: sPendle,
        abi: stakedPendleAbi,
        functionName: "balanceOf",
        args: [user],
        blockNumber: b - 1n,
      }),
    ),
  );
}
