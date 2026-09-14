import type { Address, Hex } from "viem";
import {
  cooldownCanceledEvent,
  cooldownInitiatedEvent,
  erc20Abi,
  merkleDistributorAbi,
  newLockPositionEvent,
  stakedEvent,
  stakedPendleAbi,
  transferEvent,
  unstakedEvent,
  votingEscrowAbi,
} from "./abis";
import { client, userClient } from "./client";
import {
  ADDRESSES,
  KNOWN_WALLETS,
  LIVE_WEEKS,
  SNAPSHOT_BLOCK,
  SNAPSHOT_TS,
  SNAPSHOT_WEEKS,
  VE_PENDLE_FROM_BLOCK,
  WEEK,
  EPOCH_SECONDS,
  FEE_EPOCH_ORIGIN,
  type WalletCategory,
} from "./config";
import { toTokens, type LockBucket } from "./model";

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
  /** vePENDLE lock events per closed 1M-block range; history never changes. */
  lockChunks: Map<string, Promise<LockEvent[]>>;
};
const cache: ChainCache = ((globalThis as typeof globalThis & { __spendleChainCache?: ChainCache }).__spendleChainCache ??= {
  distributions: new Map(),
  windows: new Map(),
  lockChunks: new Map(),
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
    userClient.multicall({
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
    userClient.multicall({
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

export type UserEpochState = {
  /** sPENDLE in the wallet the block before the distribution landed. */
  balance: bigint;
  /** Cumulative sPENDLE rewards the user had claimed from the distributor by that block. */
  claimed: bigint;
};

/**
 * The user's sPENDLE balance and cumulative claims the block before each distribution, walked back
 * from the balance and claimed total at `atBlock` through the wallet's sPENDLE transfer logs (two
 * `eth_getLogs`, in and out) instead of one historical multicall per distribution. Unclaimed rewards
 * keep earning, so a holder's eligible sPENDLE is wallet balance plus rewards accrued but not yet
 * claimed; the claimed figure lets the caller reconstruct the unclaimed part per epoch. Claims are
 * the transfers from the distributor to the wallet.
 */
export async function fetchUserEpochStates(
  user: Address,
  blocks: bigint[],
  at: { block: bigint; balance: bigint; claimed: bigint },
): Promise<UserEpochState[]> {
  const range = { address: sPendle, event: transferEvent, fromBlock: SNAPSHOT_BLOCK, toBlock: at.block } as const;
  const [ins, outs] = await Promise.all([
    userClient.getLogs({ ...range, args: { to: user } }),
    userClient.getLogs({ ...range, args: { from: user } }),
  ]);
  const distributor = merkleDistributor.toLowerCase();
  return blocks.map((b) => {
    // State at b − 1: undo every transfer mined at block b or later, up to `at.block`.
    let balance = at.balance;
    let claimed = at.claimed;
    for (const l of ins) {
      if (l.blockNumber < b) continue;
      balance -= l.args.value!;
      if (l.args.from!.toLowerCase() === distributor) claimed -= l.args.value!;
    }
    for (const l of outs) if (l.blockNumber >= b) balance += l.args.value!;
    return { balance, claimed };
  });
}

/** How long after a vePENDLE withdrawal a stake by the same wallet counts as "restaked". */
export const RESTAKE_WINDOW = 30 * 86_400;

export type MigrationWeek = {
  /** Week start (Thursday 00:00 UTC, the vePENDLE week boundary). */
  start: number;
  /** PENDLE withdrawn from expired vePENDLE locks this week. */
  withdrawn: number;
  /** Of that, staked into sPENDLE by the same wallet within RESTAKE_WINDOW. */
  restaked: number;
  /** True while some withdrawals this week still have their restake window open. */
  open: boolean;
  /** PENDLE still in the vePENDLE contract at the end of the week (or now, for the current week). */
  vePendle: number;
  /** sPENDLE supply at the end of the week (or now). */
  sPendle: number;
};

/** One wallet-level movement of PENDLE, for the "largest moves" list. */
export type Move = {
  kind: "stake" | "cooldown" | "instant" | "withdraw";
  wallet: Address;
  amount: number;
  timestamp: number;
  txHash: Hex;
};

/** Window for the "largest moves" lists. */
export const MOVES_WINDOW = 30 * 86_400;

export type Migration = {
  weeks: MigrationWeek[];
  /** Largest vePENDLE withdrawals in the last 30 days. */
  largeWithdrawals: Move[];
  totals: {
    withdrawn: number;
    restaked: number;
    /** Withdrawals whose 30-day window has closed, the denominator for the restake rate. */
    settled: number;
    settledRestaked: number;
    wallets: number;
    restakers: number;
  };
};

/**
 * vePENDLE → sPENDLE since the snapshot, from four transfer-log queries. PENDLE leaving the vePENDLE
 * contract is a withdrawal of an expired lock (`withdraw()` is the only way out); sPENDLE minted to a
 * wallet is a stake (1:1). Matched per wallet: a withdrawal counts as restaked to the extent the same
 * wallet staked within 30 days after it; the buyback contract's own stakes are excluded. Week-end
 * balances are walked back from today's balances through the same logs.
 */
export async function fetchMigration(): Promise<Migration> {
  const latest = await client.getBlock({ blockTag: "latest" });
  const range = { fromBlock: SNAPSHOT_BLOCK, toBlock: latest.number };
  const zero = "0x0000000000000000000000000000000000000000" as Address;
  const [veIn, veOut, sMint, sBurn, [veNow, sNow]] = await Promise.all([
    client.getLogs({ address: pendle, event: transferEvent, args: { to: vePendle }, ...range }),
    client.getLogs({ address: pendle, event: transferEvent, args: { from: vePendle }, ...range }),
    client.getLogs({ address: sPendle, event: transferEvent, args: { from: zero }, ...range }),
    client.getLogs({ address: sPendle, event: transferEvent, args: { to: zero }, ...range }),
    client.multicall({
      allowFailure: false,
      blockNumber: latest.number,
      contracts: [
        { address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [vePendle] },
        { address: sPendle, abi: stakedPendleAbi, functionName: "totalSupply" },
      ],
    }),
  ]);
  const dt = Number(latest.timestamp - SNAPSHOT_TS) / Number(latest.number - SNAPSHOT_BLOCK);
  const tsOf = (blockNumber: bigint) => Number(SNAPSHOT_TS) + Number(blockNumber - SNAPSHOT_BLOCK) * dt;
  const now = Number(latest.timestamp);

  // Balance at time t, walked back from now: undo every inflow and outflow that happened after t.
  const flows = (ins: typeof veIn, outs: typeof veOut) =>
    [...ins.map((l) => ({ ts: tsOf(l.blockNumber), d: l.args.value! })), ...outs.map((l) => ({ ts: tsOf(l.blockNumber), d: -l.args.value! }))];
  const veFlows = flows(veIn, veOut);
  const sFlows = flows(sMint, sBurn);
  const balanceAt = (nowValue: bigint, list: { ts: number; d: bigint }[], t: number) =>
    list.reduce((v, f) => (f.ts > t ? v - f.d : v), nowValue);

  // Stakes per wallet, in time order, with the amount not yet matched to a withdrawal.
  const excluded = new Set([buyback.toLowerCase()]);
  const stakesBy = new Map<string, { ts: number; left: bigint }[]>();
  for (const l of sMint) {
    const user = l.args.to!.toLowerCase();
    if (excluded.has(user)) continue;
    const list = stakesBy.get(user) ?? [];
    list.push({ ts: tsOf(l.blockNumber), left: l.args.value! });
    stakesBy.set(user, list);
  }

  const week = Number(WEEK);
  const weekOf = (ts: number) => Math.floor(ts / week) * week;
  const buckets = new Map<number, { withdrawn: bigint; restaked: bigint; open: boolean }>();
  const wallets = new Set<string>();
  const restakers = new Set<string>();
  let settled = 0n;
  let settledRestaked = 0n;
  for (const l of [...veOut].sort((a, b) => Number(a.blockNumber - b.blockNumber))) {
    const user = l.args.to!.toLowerCase();
    const ts = tsOf(l.blockNumber);
    const amount = l.args.value!;
    wallets.add(user);
    let restaked = 0n;
    for (const s of stakesBy.get(user) ?? []) {
      if (s.ts <= ts || s.ts > ts + RESTAKE_WINDOW || s.left === 0n) continue;
      const take = s.left < amount - restaked ? s.left : amount - restaked;
      s.left -= take;
      restaked += take;
      if (restaked === amount) break;
    }
    if (restaked > 0n) restakers.add(user);
    const open = ts + RESTAKE_WINDOW > now;
    if (!open) {
      settled += amount;
      settledRestaked += restaked;
    }
    const k = weekOf(ts);
    const b = buckets.get(k) ?? { withdrawn: 0n, restaked: 0n, open: false };
    b.withdrawn += amount;
    b.restaked += restaked;
    b.open ||= open;
    buckets.set(k, b);
  }

  // Every week from the snapshot's week to the current one, with week-end balances.
  const starts: number[] = [];
  for (let t = weekOf(Number(SNAPSHOT_TS)); t <= now; t += week) starts.push(t);
  const weeks: MigrationWeek[] = starts.map((start) => {
    const b = buckets.get(start) ?? { withdrawn: 0n, restaked: 0n, open: false };
    const end = Math.min(start + week, now);
    return {
      start,
      withdrawn: toTokens(b.withdrawn),
      restaked: toTokens(b.restaked),
      open: b.open,
      vePendle: toTokens(balanceAt(veNow, veFlows, end)),
      sPendle: toTokens(balanceAt(sNow, sFlows, end)),
    };
  });
  const sum = (f: (w: MigrationWeek) => number) => weeks.reduce((s, w) => s + f(w), 0);
  const largeWithdrawals: Move[] = veOut
    .filter((l) => tsOf(l.blockNumber) >= now - MOVES_WINDOW)
    .map((l) => ({ kind: "withdraw" as const, wallet: l.args.to!, amount: toTokens(l.args.value!), timestamp: Math.round(tsOf(l.blockNumber)), txHash: l.transactionHash }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  return {
    weeks,
    largeWithdrawals,
    totals: {
      withdrawn: sum((w) => w.withdrawn),
      restaked: sum((w) => w.restaked),
      settled: toTokens(settled),
      settledRestaked: toTokens(settledRestaked),
      wallets: wallets.size,
      restakers: restakers.size,
    },
  };
}

export type FlowWeek = {
  /** Week start (Thursday 00:00 UTC). */
  start: number;
  /** PENDLE staked by holders this week; the buyback contract's own stakes (reward distributions) are excluded. */
  staked: number;
  /** sPENDLE sent into the 14-day cooldown (burned at once). */
  toCooldown: number;
  /** sPENDLE unstaked instantly, gross of the fee. */
  instant: number;
  /** Fee paid on those instant unstakes, in PENDLE. */
  instantFee: number;
  /** Cooldowns cancelled (sPENDLE re-minted). */
  cancelled: number;
  /** PENDLE in the cooldown queue at the end of the week (or now). */
  queueEnd: number;
};

export type Flows = {
  weeks: FlowWeek[];
  totals: { staked: number; toCooldown: number; instant: number; instantFee: number; instantCount: number; cancelled: number };
  /** Net holder flow over the last 7 and 30 days: staked − (cooldown + instant − cancelled). */
  net7d: number;
  net30d: number;
  /** Cooldown queue now and 7 days ago. */
  queue: { now: number; weekAgo: number };
  /** Largest stakes, cooldowns, and instant unstakes in the last 30 days. */
  largeMoves: Move[];
};

/**
 * sPENDLE stake and unstake flows since the snapshot, from the staking contract's four events.
 * The cooldown queue is walked back from today's (PENDLE held − sPENDLE supply) through cooldown
 * starts, cancellations, and finalisations (`Unstaked` with `fee = 0`); instant unstakes never
 * enter the queue. Timestamps are interpolated between the snapshot block and the latest one.
 */
export async function fetchFlows(): Promise<Flows> {
  const latest = await client.getBlock({ blockTag: "latest" });
  const range = { address: sPendle, fromBlock: SNAPSHOT_BLOCK, toBlock: latest.number } as const;
  const [staked, unstaked, initiated, cancelled, [pendleHeld, supply]] = await Promise.all([
    client.getLogs({ ...range, event: stakedEvent }),
    client.getLogs({ ...range, event: unstakedEvent }),
    client.getLogs({ ...range, event: cooldownInitiatedEvent }),
    client.getLogs({ ...range, event: cooldownCanceledEvent }),
    client.multicall({
      allowFailure: false,
      blockNumber: latest.number,
      contracts: [
        { address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [sPendle] },
        { address: sPendle, abi: stakedPendleAbi, functionName: "totalSupply" },
      ],
    }),
  ]);
  const dt = Number(latest.timestamp - SNAPSHOT_TS) / Number(latest.number - SNAPSHOT_BLOCK);
  const tsOf = (blockNumber: bigint) => Number(SNAPSHOT_TS) + Number(blockNumber - SNAPSHOT_BLOCK) * dt;
  const now = Number(latest.timestamp);
  const week = Number(WEEK);
  const weekOf = (ts: number) => Math.floor(ts / week) * week;
  const buybackAddr = buyback.toLowerCase();

  type Ev = { ts: number; amount: bigint; fee: bigint; user: Address; txHash: Hex };
  const ev = (l: { blockNumber: bigint; transactionHash: Hex }, user: Address, amount: bigint, fee = 0n): Ev => ({
    ts: tsOf(l.blockNumber),
    amount,
    fee,
    user,
    txHash: l.transactionHash,
  });
  const stakes = staked.filter((l) => l.args.user!.toLowerCase() !== buybackAddr).map((l) => ev(l, l.args.user!, l.args.amount!));
  const cooldowns = initiated.map((l) => ev(l, l.args.user!, l.args.amount!));
  const cancels = cancelled.map((l) => ev(l, l.args.user!, l.args.amount!));
  const instants = unstaked.filter((l) => l.args.fee! > 0n).map((l) => ev(l, l.args.user!, l.args.amountAfterFee! + l.args.fee!, l.args.fee!));
  const finalised = unstaked.filter((l) => l.args.fee! === 0n).map((l) => ev(l, l.args.user!, l.args.amountAfterFee!));

  // Queue at time t: undo every queue change after t.
  const queueNow = pendleHeld - supply;
  const queueAt = (t: number) => {
    let q = queueNow;
    for (const e of cooldowns) if (e.ts > t) q -= e.amount;
    for (const e of cancels) if (e.ts > t) q += e.amount;
    for (const e of finalised) if (e.ts > t) q += e.amount;
    return q;
  };

  const sumIn = (list: Ev[], from: number, to: number, f: (e: Ev) => bigint = (e) => e.amount) =>
    list.reduce((s, e) => (e.ts >= from && e.ts < to ? s + f(e) : s), 0n);
  const starts: number[] = [];
  for (let t = weekOf(Number(SNAPSHOT_TS)); t <= now; t += week) starts.push(t);
  const weeks: FlowWeek[] = starts.map((start) => {
    const end = start + week;
    return {
      start,
      staked: toTokens(sumIn(stakes, start, end)),
      toCooldown: toTokens(sumIn(cooldowns, start, end)),
      instant: toTokens(sumIn(instants, start, end)),
      instantFee: toTokens(sumIn(instants, start, end, (e) => e.fee)),
      cancelled: toTokens(sumIn(cancels, start, end)),
      queueEnd: toTokens(queueAt(Math.min(end, now))),
    };
  });
  const netOver = (days: number) => {
    const from = now - days * 86_400;
    const to = now + 1;
    return toTokens(sumIn(stakes, from, to) - sumIn(cooldowns, from, to) - sumIn(instants, from, to) + sumIn(cancels, from, to));
  };
  const move = (kind: Move["kind"]) => (e: Ev): Move => ({ kind, wallet: e.user, amount: toTokens(e.amount), timestamp: Math.round(e.ts), txHash: e.txHash });
  const recent = (list: Ev[]) => list.filter((e) => e.ts >= now - MOVES_WINDOW);
  const largeMoves = [
    ...recent(stakes).map(move("stake")),
    ...recent(cooldowns).map(move("cooldown")),
    ...recent(instants).map(move("instant")),
  ]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  const total = (list: Ev[], f: (e: Ev) => bigint = (e) => e.amount) => toTokens(list.reduce((s, e) => s + f(e), 0n));
  return {
    weeks,
    totals: {
      staked: total(stakes),
      toCooldown: total(cooldowns),
      instant: total(instants),
      instantFee: total(instants, (e) => e.fee),
      instantCount: instants.length,
      cancelled: total(cancels),
    },
    net7d: netOver(7),
    net30d: netOver(30),
    queue: { now: toTokens(queueNow), weekAgo: toTokens(queueAt(now - 7 * 86_400)) },
    largeMoves,
  };
}

export type LockEvent = { user: Address; amount: bigint; expiry: bigint };
export type LockPosition = { user: Address; amount: number; expiry: number };

/**
 * Every wallet's live vePENDLE position: the latest `NewLockPosition` per wallet across the
 * contract's history (about 24K events in 1M-block chunks; closed chunks are memoised), kept where
 * the lock has not expired. A lock cannot be withdrawn before expiry and any change re-emits the
 * event with the new totals, so the latest event is the position. The largest are re-read with
 * `positionData` at the latest block so the figures shown are the contract's own.
 */
export async function fetchLockPositions(latestBlock: bigint, verify = 12): Promise<LockPosition[]> {
  const step = 1_000_000n;
  const ranges: [bigint, bigint][] = [];
  for (let b = VE_PENDLE_FROM_BLOCK; b <= latestBlock; b += step) {
    ranges.push([b, b + step - 1n < latestBlock ? b + step - 1n : latestBlock]);
  }
  const read = ([from, to]: [bigint, bigint]) =>
    client
      .getLogs({ address: vePendle, event: newLockPositionEvent, fromBlock: from, toBlock: to })
      .then((logs) => logs.map((l) => ({ user: l.args.user!, amount: l.args.amount!, expiry: l.args.expiry! })));
  const chunks = await Promise.all(
    ranges.map((r) => (r[1] === latestBlock ? read(r) : memo(cache.lockChunks, `${r[0]}-${r[1]}`, () => read(r)))),
  );
  const latestBy = new Map<string, LockEvent>();
  for (const chunk of chunks) for (const e of chunk) latestBy.set(e.user.toLowerCase(), e);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const active = [...latestBy.values()].filter((e) => e.expiry > now && e.amount > 0n).sort((a, b) => (b.amount > a.amount ? 1 : -1));
  const verified = await client.multicall({
    allowFailure: false,
    blockNumber: latestBlock,
    contracts: active.slice(0, verify).map((e) => ({ address: vePendle, abi: votingEscrowAbi, functionName: "positionData", args: [e.user] })),
  });
  return active.map((e, i) => {
    const [amount, expiry] = i < verify ? verified[i] : [e.amount, e.expiry];
    return { user: e.user, amount: toTokens(amount), expiry: Number(expiry) };
  });
}

export type KnownWallet = {
  address: Address;
  label: string;
  category: WalletCategory;
  /** PENDLE held now, and about 7 and 30 days ago. */
  pendle: number;
  pendle7d: number;
  pendle30d: number;
  sPendle: number;
  locked: number;
  lockExpiry: number;
};

/** Ethereum slots are 12 s; missed slots make these a little more than the nominal span. */
const BLOCKS_7D = 50_400n;
const BLOCKS_30D = 216_000n;

/** Balances of the labelled wallets now and at ~7 d / ~30 d ago, in four multicalls. */
export async function fetchKnownWallets(latestBlock: bigint): Promise<KnownWallet[]> {
  const addrs = KNOWN_WALLETS.map((w) => w.address);
  const pendleOf = (blockNumber: bigint) =>
    client.multicall({
      allowFailure: false,
      blockNumber,
      contracts: addrs.map((a) => ({ address: pendle, abi: erc20Abi, functionName: "balanceOf", args: [a] })),
    });
  const [now, d7, d30, rest] = await Promise.all([
    pendleOf(latestBlock),
    pendleOf(latestBlock - BLOCKS_7D),
    pendleOf(latestBlock - BLOCKS_30D),
    client.multicall({
      allowFailure: false,
      blockNumber: latestBlock,
      contracts: addrs.flatMap((a) => [
        { address: sPendle, abi: stakedPendleAbi, functionName: "balanceOf", args: [a] } as const,
        { address: vePendle, abi: votingEscrowAbi, functionName: "positionData", args: [a] } as const,
      ]),
    }),
  ]);
  return KNOWN_WALLETS.map((w, i) => {
    const sBal = rest[2 * i] as bigint;
    const [lockAmount, lockExpiry] = rest[2 * i + 1] as readonly [bigint, bigint];
    return {
      ...w,
      pendle: toTokens(now[i]),
      pendle7d: toTokens(d7[i]),
      pendle30d: toTokens(d30[i]),
      sPendle: toTokens(sBal),
      locked: toTokens(lockAmount),
      lockExpiry: Number(lockExpiry),
    };
  });
}
