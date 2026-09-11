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
} from "./config";
import type { LockBucket } from "./model";

const { pendle, sPendle, vePendle, buyback, merkleDistributor, usdt } = ADDRESSES;

async function readSchedule(firstWeek: bigint, weeks: number, blockNumber?: bigint) {
  const expiries = Array.from({ length: weeks }, (_, i) => firstWeek + BigInt(i) * WEEK);
  const slopes = await client.multicall({
    allowFailure: false,
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

let snapshotSchedule: Promise<LockBucket[]> | undefined;
/** vePENDLE expiry schedule as it stood at the loyalty-bonus snapshot block. Immutable, so memoised for the process lifetime. */
export function fetchSnapshotSchedule() {
  snapshotSchedule ??= readSchedule(SNAPSHOT_TS + WEEK, SNAPSHOT_WEEKS, SNAPSHOT_BLOCK);
  return snapshotSchedule;
}

export type LiveState = {
  blockNumber: bigint;
  timestamp: bigint;
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

const distributionCache = new Map<Hex, Promise<RawDistribution>>();

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
    logs.map((log) => {
      let entry = distributionCache.get(log.transactionHash);
      if (!entry) {
        entry = (async () => {
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
        })();
        distributionCache.set(log.transactionHash, entry);
      }
      return entry;
    }),
  );
}

export type BuybackWindow = {
  /** USDT the buyback contract spent on swaps in the window (6 decimals). */
  usdtSpent: bigint;
  /** PENDLE it received from those swaps (wei). */
  pendleBought: bigint;
};

const windowCache = new Map<string, Promise<BuybackWindow>>();

/**
 * Buyback execution in the block window (`after`, `upTo`]: hourly USDT → PENDLE TWAP swaps
 * through Pendle's router. `usdtSpent / pendleBought` is the realised PENDLE price for the
 * epoch whose rewards were distributed at `upTo`. Closed windows never change, so they are memoised.
 */
export function fetchBuybackWindow(after: bigint, upTo: bigint): Promise<BuybackWindow> {
  const key = `${after}-${upTo}`;
  let entry = windowCache.get(key);
  if (!entry) {
    entry = (async () => {
      const range = { fromBlock: after + 1n, toBlock: upTo };
      const [usdtOut, pendleIn] = await Promise.all([
        client.getLogs({ address: usdt, event: transferEvent, args: { from: buyback }, ...range }),
        client.getLogs({ address: pendle, event: transferEvent, args: { to: buyback }, ...range }),
      ]);
      return {
        usdtSpent: usdtOut.reduce((s, l) => s + l.args.value!, 0n),
        pendleBought: pendleIn.reduce((s, l) => s + l.args.value!, 0n),
      };
    })();
    windowCache.set(key, entry);
  }
  return entry;
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
