import type { Address } from "viem";
import { ADDRESSES, LLAMA_PRICE_API, PENDLE_API, PENDLE_PRICE_API, SNAPSHOT_TS } from "./config";

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
 * Daily PENDLE/USD closes since the snapshot, from DefiLlama's coins feed. Anchored on `end`, not
 * `start`: a start-anchored request whose span reaches past today comes back truncated to the last
 * ~118 days (and the CDN then serves that truncated body for the rest of the day), which took the
 * page down on 15 Sep 2026. Walking back from the current hour returns the full run every time; the
 * start of what comes back is still checked.
 */
export async function fetchPendleUsdHistory(now: number): Promise<PricePoint[]> {
  const end = now - (now % 3600);
  const days = Math.ceil((end - Number(SNAPSHOT_TS)) / 86_400) + 3;
  const data = await getJson<{ coins: Record<string, { prices: { timestamp: number; price: number }[] }> }>(
    `${LLAMA_PRICE_API}?end=${end}&span=${days}&period=1d`,
  );
  const coin = Object.values(data.coins)[0];
  if (!coin || coin.prices.length < 2) throw new Error("DefiLlama returned no PENDLE price history");
  const first = coin.prices[0].timestamp;
  if (first > Number(SNAPSHOT_TS) + 2 * 86_400) {
    throw new Error(`DefiLlama price history starts ${new Date(first * 1000).toISOString().slice(0, 10)}, after the snapshot`);
  }
  // Keep one point at or before the snapshot so the first buys have a neighbour, drop the rest.
  const since = Number(SNAPSHOT_TS) - 86_400;
  return coin.prices.filter((p) => p.timestamp >= since).map((p) => ({ t: p.timestamp, price: p.price }));
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
