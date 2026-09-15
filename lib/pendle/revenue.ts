import { fetchBuybackFunding, fetchGaugePendleOutflow } from "./chain";
import { fetchApiEpochs } from "./pendle-api";
import {
  EPOCH_SECONDS,
  FEE_EPOCH_ORIGIN,
  LLAMA_FEES_API,
  LLAMA_TVL_API,
  PENDLE_EMISSION_API,
  SNAPSHOT_TS,
} from "./config";
import { toTokens } from "./model";

export type FeeDay = {
  t: number;
  fees: number;
  revenue: number;
  lp: number;
  holders: number;
  protocol: number;
  swap: number;
  yt: number;
};

export type FeeEpoch = {
  start: number;
  /** Days elapsed since `start` by wall clock, capped at 14. */
  days: number;
  complete: boolean;
  fees: number;
  revenue: number;
  lp: number;
  swap: number;
  swapToProtocol: number;
  /** DefiLlama Revenue minus 80% of gross swap: YT, limit-order and points fees, airdrop tokens booked at the treasury. */
  yt: number;
  /** 80% policy share of DefiLlama Revenue; a policy figure, not a flow. */
  buyback: number;
  treasury: number;
  ops: number;
  emittedPendle: number;
  /** USDT actually sent to the buyback contract for this epoch (USD). */
  buybackFunded: number;
  /** No further funding can be attributed to this epoch: `start + 21d ≤ now`. */
  buybackWindowClosed: boolean;
  /**
   * The buyback executed for this epoch: PENDLE bought with that USDT and paid to stakers as sPENDLE in
   * the distribution that landed 14–28 days after `start`, and the USDT the contract spent buying it.
   * `null` until that distribution lands.
   */
  bought: { pendle: number; usd: number; distributedAt: number } | null;
  /** In-kind airdrops Pendle passed to stakers for this epoch, in USD as its API reports them; `null` where the API has no row. */
  airdropUsd: number | null;
};

export type CumPoint = {
  t: number;
  yt: number;
  swap: number;
  buyback: number;
  buybackFunded: number;
  treasury: number;
  ops: number;
  lp: number;
  emittedPendle: number;
};

export type AimWeek = {
  pendle: number;
  tvl: number;
  fee: number;
  discretionary: number;
  cobribing: number;
  limitOrder: number;
  markets: number;
};

export type RevenueTotals = {
  fees: number;
  revenue: number;
  yt: number;
  swap: number;
  lp: number;
  buyback: number;
  buybackFunded: number;
  /** PENDLE bought and paid to stakers across every distribution so far. */
  boughtPendle: number;
  /** USDT the buyback contract spent buying it. */
  boughtUsd: number;
  treasury: number;
  ops: number;
  emittedPendle: number;
};

export type RevenueData = {
  days: FeeDay[];
  epochs: FeeEpoch[];
  latestComplete: FeeEpoch;
  current: FeeEpoch;
  aim: AimWeek;
  totals: RevenueTotals;
  cumulative: CumPoint[];
  gaugePendle: number;
  /** In-kind airdrops over the epochs Pendle's API covers (its last 12). */
  airdrops: { usd: number; epochs: number; from: number };
};

type LlamaBreakdown = [number, Record<string, Record<string, number>>][];
type LlamaSummary = { totalDataChartBreakdown: LlamaBreakdown };

type EmissionMarket = {
  totalIncentive: number;
  tvlIncentive: number;
  feeIncentive: number;
  discretionaryIncentive: number;
  cobribingIncentive: number;
  limitOrderIncentive?: number;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function v2Usd(row: LlamaBreakdown[number]): number {
  let n = 0;
  for (const chain of Object.values(row[1])) n += chain["Pendle V2"] ?? 0;
  return n;
}

function byDay(rows: LlamaBreakdown): Map<number, number> {
  return new Map(rows.map((row) => [row[0], v2Usd(row)]));
}

function llama(kind: string) {
  return getJson<LlamaSummary>(`${LLAMA_FEES_API}?dataType=${kind}`);
}

/** Pendle V2 TVL, USD, every chain: DefiLlama's headline figure, so staked PENDLE, pool2 and Boros are out. */
export async function fetchPendleTvl(): Promise<number> {
  const tvl = await getJson<number>(LLAMA_TVL_API);
  if (typeof tvl !== "number" || !(tvl > 0)) throw new Error(`DefiLlama returned no Pendle V2 TVL: ${JSON.stringify(tvl)}`);
  return tvl;
}

function epochStart(ts: number) {
  return FEE_EPOCH_ORIGIN + Math.floor((ts - FEE_EPOCH_ORIGIN) / EPOCH_SECONDS) * EPOCH_SECONDS;
}

/**
 * Buyback funding lands around a fee epoch's end: observed 0.3 days before to 3.3 days after `start
 * + 14d`. A transfer at `t` belongs to the epoch whose end is nearest, `T + 7d ≤ t < T + 21d`; this
 * reproduces Pendle's hub `fees[]` per epoch, which the `T + 14d ≤ t < T + 28d` distribution
 * mapping does not (it puts Monday-evening funding in the previous epoch).
 */
const FUNDING_HALF_WINDOW = EPOCH_SECONDS / 2;
function fundedEpochStart(t: number) {
  return epochStart(t - FUNDING_HALF_WINDOW);
}

/** Gross swap from the 20% LP cut; YT is whatever DefiLlama Revenue is not the 80% swap take. */
function derive(revenue: number, lp: number) {
  const swap = lp / 0.2;
  return { swap: Math.max(swap, 0), yt: Math.max(revenue - 0.8 * swap, 0) };
}

function zeroTotals(): RevenueTotals {
  return {
    fees: 0,
    revenue: 0,
    yt: 0,
    swap: 0,
    lp: 0,
    buyback: 0,
    buybackFunded: 0,
    boughtPendle: 0,
    boughtUsd: 0,
    treasury: 0,
    ops: 0,
    emittedPendle: 0,
  };
}

function addEpoch(s: RevenueTotals, e: FeeEpoch): RevenueTotals {
  return {
    fees: s.fees + e.fees,
    revenue: s.revenue + e.revenue,
    yt: s.yt + e.yt,
    swap: s.swap + e.swap,
    lp: s.lp + e.lp,
    buyback: s.buyback + e.buyback,
    buybackFunded: s.buybackFunded + e.buybackFunded,
    boughtPendle: s.boughtPendle + (e.bought?.pendle ?? 0),
    boughtUsd: s.boughtUsd + (e.bought?.usd ?? 0),
    treasury: s.treasury + e.treasury,
    ops: s.ops + e.ops,
    emittedPendle: s.emittedPendle + e.emittedPendle,
  };
}

function toEpoch(
  start: number,
  bucket: FeeDay[],
  emittedPendle: number,
  buybackFunded: number,
  airdropUsd: number | null,
  now: number,
): FeeEpoch {
  const sum = (k: keyof FeeDay) => bucket.reduce((s, d) => s + d[k], 0);
  const protocol = sum("protocol");
  const swap = sum("swap");
  return {
    start,
    days: Math.floor(Math.min(now - start, EPOCH_SECONDS) / 86_400),
    complete: start + EPOCH_SECONDS <= now,
    fees: sum("fees"),
    revenue: sum("revenue"),
    lp: sum("lp"),
    swap,
    swapToProtocol: 0.8 * swap,
    yt: sum("yt"),
    buyback: sum("holders"),
    treasury: protocol / 2,
    ops: protocol / 2,
    emittedPendle,
    buybackFunded,
    buybackWindowClosed: start + EPOCH_SECONDS + FUNDING_HALF_WINDOW <= now,
    bought: null,
    airdropUsd,
  };
}

export async function getRevenueData(): Promise<RevenueData> {
  const [feesS, revenueS, lpS, holdersS, protocolS, emission, outflow, funding, apiEpochs] = await Promise.all([
    llama("dailyFees"),
    llama("dailyRevenue"),
    llama("dailySupplySideRevenue"),
    llama("dailyHoldersRevenue"),
    llama("dailyProtocolRevenue"),
    getJson<{ markets: EmissionMarket[] }>(PENDLE_EMISSION_API),
    fetchGaugePendleOutflow(),
    fetchBuybackFunding(),
    fetchApiEpochs(),
  ]);

  const feesM = byDay(feesS.totalDataChartBreakdown);
  const revenueM = byDay(revenueS.totalDataChartBreakdown);
  const lpM = byDay(lpS.totalDataChartBreakdown);
  const holdersM = byDay(holdersS.totalDataChartBreakdown);
  const protocolM = byDay(protocolS.totalDataChartBreakdown);

  const days: FeeDay[] = [...feesM.keys()]
    .filter(
      (t) =>
        t >= Number(SNAPSHOT_TS) &&
        revenueM.has(t) &&
        lpM.has(t) &&
        holdersM.has(t) &&
        protocolM.has(t),
    )
    .sort((a, b) => a - b)
    .map((t) => {
      const revenue = revenueM.get(t)!;
      const lp = lpM.get(t)!;
      const { swap, yt } = derive(revenue, lp);
      return {
        t,
        fees: feesM.get(t)!,
        revenue,
        lp,
        holders: holdersM.get(t)!,
        protocol: protocolM.get(t)!,
        swap,
        yt,
      };
    });
  if (days.length === 0) throw new Error("DefiLlama returned no Pendle V2 fee days in the sPENDLE-era window");
  if (outflow.spent.length === 0) throw new Error("No PENDLE outflow from the Ethereum gauge controller since the snapshot");
  if (funding.length === 0) throw new Error("No USDT funding of the buyback contract since the snapshot");

  const emitByEpoch = new Map<number, number>();
  for (const m of outflow.spent) {
    const start = epochStart(m.timestamp);
    emitByEpoch.set(start, (emitByEpoch.get(start) ?? 0) + toTokens(m.amount));
  }

  const grouped = new Map<number, FeeDay[]>();
  for (const d of days) {
    const start = epochStart(d.t);
    const bucket = grouped.get(start);
    if (bucket) bucket.push(d);
    else grouped.set(start, [d]);
  }

  const fundedByEpoch = new Map<number, number>();
  for (const f of funding) {
    const start = fundedEpochStart(f.timestamp);
    if (!grouped.has(start)) {
      throw new Error(
        `Buyback funding at ${new Date(f.timestamp * 1000).toISOString()} maps to fee epoch ${new Date(start * 1000).toISOString()} with no DefiLlama days`,
      );
    }
    fundedByEpoch.set(start, (fundedByEpoch.get(start) ?? 0) + Number(f.usdt) / 1e6);
  }

  if (apiEpochs.length === 0) throw new Error("Pendle API returned no sPENDLE epochs");
  const airdropByEpoch = new Map(apiEpochs.map((a) => [a.start, a.airdropUsd]));

  const now = Date.now() / 1000;
  const epochs: FeeEpoch[] = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, bucket]) =>
      toEpoch(
        start,
        bucket,
        emitByEpoch.get(start) ?? 0,
        fundedByEpoch.get(start) ?? 0,
        airdropByEpoch.get(start) ?? null,
        now,
      ),
    );

  const complete = epochs.filter((e) => e.complete);
  if (complete.length === 0) throw new Error("No complete fee epoch in the DefiLlama series");
  const latestComplete = complete[complete.length - 1];
  const current = epochs[epochs.length - 1];

  const totals = epochs.reduce(addEpoch, zeroTotals());

  const cumulative: CumPoint[] = [];
  let c = { yt: 0, swap: 0, buyback: 0, buybackFunded: 0, treasury: 0, ops: 0, lp: 0, emittedPendle: 0 };
  for (const e of epochs) {
    c = {
      yt: c.yt + e.yt,
      swap: c.swap + e.swap,
      buyback: c.buyback + e.buyback,
      buybackFunded: c.buybackFunded + e.buybackFunded,
      treasury: c.treasury + e.treasury,
      ops: c.ops + e.ops,
      lp: c.lp + e.lp,
      emittedPendle: c.emittedPendle + e.emittedPendle,
    };
    cumulative.push({ t: e.start, ...c });
  }

  const markets = emission.markets;
  if (markets.length === 0) throw new Error("Pendle emission API returned no markets");

  return {
    days,
    epochs,
    latestComplete,
    current,
    aim: {
      pendle: markets.reduce((s, m) => s + m.totalIncentive, 0),
      tvl: markets.reduce((s, m) => s + m.tvlIncentive, 0),
      fee: markets.reduce((s, m) => s + m.feeIncentive, 0),
      discretionary: markets.reduce((s, m) => s + m.discretionaryIncentive, 0),
      cobribing: markets.reduce((s, m) => s + m.cobribingIncentive, 0),
      limitOrder: markets.reduce((s, m) => s + (m.limitOrderIncentive ?? 0), 0),
      markets: markets.length,
    },
    totals,
    cumulative,
    gaugePendle: outflow.gaugePendle,
    airdrops: {
      usd: apiEpochs.reduce((s, a) => s + a.airdropUsd, 0),
      epochs: apiEpochs.length,
      from: Math.min(...apiEpochs.map((a) => a.start)),
    },
  };
}

export type ExecutedBuyback = { distributedAt: number; pendle: number; usd: number };

/**
 * Attach each executed buyback to its fee epoch. The buyback for the epoch starting `T` is funded
 * around `T + 14d`, executed by hourly TWAP over the following weeks, and paid to stakers in the
 * distribution that lands in `[T + 14d, T + 28d)`; that distribution's PENDLE is the epoch's buyback.
 */
export function withExecutedBuybacks(revenue: RevenueData, executed: ExecutedBuyback[]): RevenueData {
  const byEpoch = new Map<number, ExecutedBuyback>();
  for (const x of executed) {
    const start = epochStart(x.distributedAt - EPOCH_SECONDS);
    if (!revenue.epochs.some((e) => e.start === start)) {
      throw new Error(
        `Distribution at ${new Date(x.distributedAt * 1000).toISOString()} maps to fee epoch ${new Date(start * 1000).toISOString()} with no DefiLlama days`,
      );
    }
    if (byEpoch.has(start)) {
      throw new Error(`Two distributions map to the fee epoch starting ${new Date(start * 1000).toISOString()}`);
    }
    byEpoch.set(start, x);
  }
  const epochs = revenue.epochs.map((e) => {
    const x = byEpoch.get(e.start);
    return x ? { ...e, bought: { pendle: x.pendle, usd: x.usd, distributedAt: x.distributedAt } } : e;
  });
  const find = (start: number) => epochs.find((e) => e.start === start)!;
  return {
    ...revenue,
    epochs,
    latestComplete: find(revenue.latestComplete.start),
    current: find(revenue.current.start),
    totals: epochs.reduce(addEpoch, zeroTotals()),
  };
}
