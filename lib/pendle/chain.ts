import type { Hex } from "viem";
import { erc20Abi, stakedPendleAbi, transferEvent, votingEscrowAbi } from "./abis";
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

const { pendle, sPendle, vePendle, buyback, merkleDistributor } = ADDRESSES;

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
