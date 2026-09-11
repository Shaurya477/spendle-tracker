import { fetchGaugePendleOutflow } from "./chain";
import {
  EPOCH_SECONDS,
  FEE_EPOCH_ORIGIN,
  LLAMA_FEES_API,
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
  days: number;
  complete: boolean;
  fees: number;
  revenue: number;
  lp: number;
  swap: number;
  swapToProtocol: number;
  yt: number;
  buyback: number;
  treasury: number;
  ops: number;
  emittedPendle: number;
};

export type CumPoint = {
  t: number;
  yt: number;
  swap: number;
  buyback: number;
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

function epochStart(ts: number) {
  return FEE_EPOCH_ORIGIN + Math.floor((ts - FEE_EPOCH_ORIGIN) / EPOCH_SECONDS) * EPOCH_SECONDS;
}

/** Gross swap from the 20% LP cut; YT is whatever protocol revenue is not the 80% swap take. */
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
    treasury: s.treasury + e.treasury,
    ops: s.ops + e.ops,
    emittedPendle: s.emittedPendle + e.emittedPendle,
  };
}

function toEpoch(start: number, bucket: FeeDay[], emittedPendle: number, now: number): FeeEpoch {
  const sum = (k: keyof FeeDay) => bucket.reduce((s, d) => s + d[k], 0);
  const protocol = sum("protocol");
  const swap = sum("swap");
  return {
    start,
    days: bucket.length,
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
  };
}

export async function getRevenueData(): Promise<RevenueData> {
  const [feesS, revenueS, lpS, holdersS, protocolS, emission, outflow] = await Promise.all([
    llama("dailyFees"),
    llama("dailyRevenue"),
    llama("dailySupplySideRevenue"),
    llama("dailyHoldersRevenue"),
    llama("dailyProtocolRevenue"),
    getJson<{ markets: EmissionMarket[] }>(PENDLE_EMISSION_API),
    fetchGaugePendleOutflow(),
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

  const now = Date.now() / 1000;
  const epochs: FeeEpoch[] = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, bucket]) => toEpoch(start, bucket, emitByEpoch.get(start) ?? 0, now));

  const complete = epochs.filter((e) => e.complete);
  if (complete.length === 0) throw new Error("No complete fee epoch in the DefiLlama series");
  const latestComplete = complete[complete.length - 1];
  const current = epochs[epochs.length - 1];

  const totals = epochs.reduce(addEpoch, zeroTotals());

  const cumulative: CumPoint[] = [];
  let c = { yt: 0, swap: 0, buyback: 0, treasury: 0, ops: 0, lp: 0, emittedPendle: 0 };
  for (const e of epochs) {
    c = {
      yt: c.yt + e.yt,
      swap: c.swap + e.swap,
      buyback: c.buyback + e.buyback,
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
  };
}
