import { EPOCHS_PER_YEAR } from "./config";
import type { PricePoint } from "./pendle-api";
import type { RevenueData } from "./revenue";
import type { Distribution } from "./tracker";

export type Valuation = {
  price: number;
  /** Total supply × price. */
  fdv: number;
  /** Circulating supply × price, circulating being total minus Pendle's own wallets and contracts. */
  marketCap: number;
  circulating: number;
  /** PENDLE in Pendle's multisigs, treasury, and protocol contracts, excluded from circulating. */
  pendleHeld: number;
  /** Trailing four complete fee epochs, annualised. */
  feesAnnual: number;
  revenueAnnual: number;
  /** Trailing six distributions' USDT spent on buybacks, annualised. */
  buybackAnnual: number;
  /** AIM's weekly PENDLE assignment × 52 × price. */
  emissionsAnnualUsd: number;
  /** Pendle V2 deposits across every chain, USD (DefiLlama headline TVL: staked PENDLE, pool2 and Boros excluded). */
  tvl: number;
  /** Market cap and FDV ÷ TVL: what the market pays per dollar deposited in the protocol. */
  mcapToTvl: number;
  fdvToTvl: number;
  /** Annualised fees ÷ market cap: the earnings-yield analogue for the token. */
  feeYield: number;
  /** Annualised buyback spend ÷ market cap: what reaches stakers, as a yield on the whole float. */
  buybackYield: number;
  /** (Buybacks − emissions) ÷ market cap. */
  netBuybackYield: number;
  /** Buyback USDT funded ÷ DefiLlama revenue over the last four closed funding windows; policy says up to 80%. */
  payoutRatio: number;
  payoutEpochs: number;
  /**
   * Each distribution's buyback: the price paid (USDT spent ÷ PENDLE bought), the market's daily close
   * on the days the TWAP was buying weighted by USDT spent each day, and paid ÷ benchmark − 1.
   */
  buybackPrices: {
    epoch: number;
    timestamp: number;
    price: number;
    pendle: number;
    usd: number;
    benchmark: number;
    slippage: number;
    /** First and last buy of the window. */
    from: number;
    to: number;
  }[];
  /** Daily PENDLE/USD since the snapshot, ending at the live quote. */
  priceHistory: PricePoint[];
  /** Everything bought so far: USDT spent, PENDLE received, and what that PENDLE is worth today. */
  bought: { usd: number; pendle: number; avgPaid: number; valueToday: number; gain: number };
  epochsUsed: number;
  distributionsUsed: number;
};

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function buildValuation(input: {
  price: number;
  totalSupply: number;
  pendleHeld: number;
  revenue: RevenueData;
  distributions: Distribution[];
  priceHistory: PricePoint[];
  tvl: number;
  now: number;
}): Valuation {
  const { price, totalSupply, pendleHeld, revenue, distributions, priceHistory, tvl, now } = input;
  const complete = revenue.epochs.filter((e) => e.complete).slice(-4);
  if (complete.length < 2) throw new Error("Valuation needs at least two complete fee epochs");
  const closed = revenue.epochs.filter((e) => e.buybackWindowClosed && e.buybackFunded > 0).slice(-4);
  if (closed.length < 2) throw new Error("Valuation needs at least two closed buyback funding windows");
  const recent = distributions.slice(-6);

  // Each buy is matched to the nearest daily close in time, so a missing day or a buy near midnight
  // still finds a neighbour.
  const sorted = [...priceHistory].sort((a, b) => a.t - b.t);
  const priceAt = (t: number) => {
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    const near = lo > 0 && t - sorted[lo - 1].t < sorted[lo].t - t ? sorted[lo - 1] : sorted[lo];
    if (Math.abs(near.t - t) > 2 * 86_400) {
      throw new Error(`No PENDLE price within two days of ${new Date(t * 1000).toISOString().slice(0, 10)}`);
    }
    return near.price;
  };
  const buybackPrices = distributions
    .filter((d) => d.pendleBought > 0)
    .map((d) => {
      let weighted = 0;
      let weight = 0;
      for (const b of d.buys) {
        weighted += b.usd * priceAt(b.t);
        weight += b.usd;
      }
      const price = d.usdtSpent / d.pendleBought;
      const benchmark = weighted / weight;
      return {
        epoch: d.epoch,
        timestamp: d.timestamp,
        price,
        pendle: d.pendleBought,
        usd: d.usdtSpent,
        benchmark,
        slippage: price / benchmark - 1,
        from: d.buys[0].t,
        to: d.buys[d.buys.length - 1].t,
      };
    });
  const spentAll = buybackPrices.reduce((s, b) => s + b.usd, 0);
  const boughtAll = buybackPrices.reduce((s, b) => s + b.pendle, 0);

  const circulating = totalSupply - pendleHeld;
  const fdv = totalSupply * price;
  const marketCap = circulating * price;
  const feesAnnual = mean(complete.map((e) => e.fees)) * EPOCHS_PER_YEAR;
  const revenueAnnual = mean(complete.map((e) => e.revenue)) * EPOCHS_PER_YEAR;
  const buybackAnnual = mean(recent.map((d) => d.usdtSpent)) * EPOCHS_PER_YEAR;
  const emissionsAnnualUsd = revenue.aim.pendle * 52 * price;
  const funded = closed.reduce((s, e) => s + e.buybackFunded, 0);
  const rev = closed.reduce((s, e) => s + e.revenue, 0);

  return {
    price,
    fdv,
    marketCap,
    circulating,
    pendleHeld,
    feesAnnual,
    revenueAnnual,
    buybackAnnual,
    emissionsAnnualUsd,
    tvl,
    mcapToTvl: marketCap / tvl,
    fdvToTvl: fdv / tvl,
    feeYield: feesAnnual / marketCap,
    buybackYield: buybackAnnual / marketCap,
    netBuybackYield: (buybackAnnual - emissionsAnnualUsd) / marketCap,
    payoutRatio: funded / rev,
    payoutEpochs: closed.length,
    buybackPrices,
    priceHistory: [...priceHistory.filter((p) => p.t < now - 3600), { t: now, price }],
    bought: {
      usd: spentAll,
      pendle: boughtAll,
      avgPaid: spentAll / boughtAll,
      valueToday: boughtAll * price,
      gain: (boughtAll * price) / spentAll - 1,
    },
    epochsUsed: complete.length,
    distributionsUsed: recent.length,
  };
}
