import type { Address } from "viem";
import { ADDRESSES, COINBASE_CANDLES_API, PENDLE_API, PENDLE_PRICE_API, SNAPSHOT_TS } from "./config";

export type AirdropToken = { token: string; amount: number; valueInUSD: number };

export type ApiEpoch = {
  /** Start of the fee-collection epoch (Tuesday 00:00 UTC). */
  start: number;
  feesUsd: number;
  airdropUsd: number;
  airdrops: AirdropToken[];
};

type SpendleData = {
  sPendleHistoricalData: {
    timestamps: number[];
    fees: number[];
    airdropInUSDs: number[];
    airdropBreakdowns: AirdropToken[][];
  };
};

type SpendleUser = {
  allTimeRewards: {
    tokens: Record<string, { totalAmount: string; totalAmountInUsd: number }>;
    lastDistributionAt: string;
  };
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pendle API ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

/** Per-epoch fee and in-kind airdrop data as Pendle publishes it (last 12 epochs). */
export async function fetchApiEpochs(): Promise<ApiEpoch[]> {
  const { sPendleHistoricalData: h } = await getJson<SpendleData>(`${PENDLE_API}/data`);
  return h.timestamps.map((start, i) => ({
    start,
    feesUsd: h.fees[i],
    airdropUsd: h.airdropInUSDs[i],
    airdrops: h.airdropBreakdowns[i],
  }));
}

/** Live PENDLE/USD from Pendle's asset-price feed. Fails if the quote is missing. */
export async function fetchPendleUsd(): Promise<number> {
  const id = `1-${ADDRESSES.pendle.toLowerCase()}`;
  const data = await getJson<{ prices: Record<string, number> }>(`${PENDLE_PRICE_API}?ids=${id}`);
  const price = data.prices[id];
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error(`Pendle API returned no USD price for ${id}`);
  }
  return price;
}

export type PricePoint = { t: number; price: number };

/**
 * Daily PENDLE/USD closes since the snapshot, from Coinbase Exchange's public candles. Each point is
 * a UTC day's close, timestamped at the end of that day; the day in progress closes at `now`.
 * Coinbase answers at most 300 candles per request, so the range is walked in 300-day windows.
 * (DefiLlama's chart endpoint was the source until Sep 2026; its origin intermittently dropped every
 * point before a fixed date, for minutes at a time, and took the page down twice.)
 */
export async function fetchPendleUsdHistory(now: number): Promise<PricePoint[]> {
  const DAY = 86_400;
  const since = Number(SNAPSHOT_TS) - DAY;
  const iso = (t: number) => new Date(t * 1000).toISOString();
  const points: PricePoint[] = [];
  for (let from = since; from < now; from += 300 * DAY) {
    const to = Math.min(from + 300 * DAY, now);
    const res = await fetch(`${COINBASE_CANDLES_API}?granularity=${DAY}&start=${iso(from)}&end=${iso(to)}`, {
      cache: "no-store",
      headers: { "User-Agent": "penconomics/1.0" },
    });
    if (!res.ok) throw new Error(`Coinbase candles → HTTP ${res.status}`);
    // [time, low, high, open, close, volume], newest first.
    const candles = (await res.json()) as [number, number, number, number, number, number][];
    for (const c of candles) points.push({ t: Math.min(c[0] + DAY, now), price: c[4] });
  }
  points.sort((a, b) => a.t - b.t);
  const expected = Math.floor((now - since) / DAY);
  if (points.length < expected - 2) {
    throw new Error(`Coinbase returned ${points.length} daily PENDLE-USD closes, expected about ${expected}`);
  }
  if (points[0].t > Number(SNAPSHOT_TS) + DAY) {
    throw new Error(`Coinbase price history starts ${iso(points[0].t).slice(0, 10)}, after the snapshot`);
  }
  return points;
}

/**
 * Pendle's own record of everything this address has accrued in sPENDLE rewards (wei).
 * The endpoint answers 404 for an address it has never paid anything; that is a zero, not a failure.
 */
export async function fetchApiUserSPendleAccrued(user: Address): Promise<bigint> {
  const res = await fetch(`${PENDLE_API}/${user}`, { cache: "no-store" });
  if (res.status === 404) return 0n;
  if (!res.ok) throw new Error(`Pendle API ${res.status} for ${user}`);
  const data = (await res.json()) as SpendleUser;
  const entry = data.allTimeRewards.tokens[`1-${ADDRESSES.sPendle.toLowerCase()}`];
  return entry ? BigInt(entry.totalAmount) : 0n;
}
