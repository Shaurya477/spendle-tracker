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
  /** FDV ÷ annualised fees and revenue. */
  fdvToFees: number;
  fdvToRevenue: number;
  mcapToFees: number;
  mcapToRevenue: number;
  /** Annualised fees ÷ market cap: the earnings-yield analogue for the token. */
  feeYield: number;
  /** Annualised buyback spend ÷ market cap: what reaches stakers, as a yield on the whole float. */
  buybackYield: number;
  /** (Buybacks − emissions) ÷ market cap. */
  netBuybackYield: number;
  /** Buyback USDT funded ÷ DefiLlama revenue over the last four closed funding windows; policy says up to 80%. */
  payoutRatio: number;
  payoutEpochs: number;
  /** Realised PENDLE price of each distribution's buyback (USDT spent ÷ PENDLE bought), for the chart. */
  buybackPrices: { epoch: number; timestamp: number; price: number; pendle: number; usd: number }[];
  /** Daily PENDLE/USD since the snapshot, ending at the live quote. */
  priceHistory: PricePoint[];
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
  now: number;
}): Valuation {
  const { price, totalSupply, pendleHeld, revenue, distributions, priceHistory, now } = input;
  const complete = revenue.epochs.filter((e) => e.complete).slice(-4);
  if (complete.length < 2) throw new Error("Valuation needs at least two complete fee epochs");
  const closed = revenue.epochs.filter((e) => e.buybackWindowClosed && e.buybackFunded > 0).slice(-4);
  if (closed.length < 2) throw new Error("Valuation needs at least two closed buyback funding windows");
  const recent = distributions.slice(-6);

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
    fdvToFees: fdv / feesAnnual,
    fdvToRevenue: fdv / revenueAnnual,
    mcapToFees: marketCap / feesAnnual,
    mcapToRevenue: marketCap / revenueAnnual,
    feeYield: feesAnnual / marketCap,
    buybackYield: buybackAnnual / marketCap,
    netBuybackYield: (buybackAnnual - emissionsAnnualUsd) / marketCap,
    payoutRatio: funded / rev,
    payoutEpochs: closed.length,
    buybackPrices: distributions
      .filter((d) => d.pendleBought > 0)
      .map((d) => ({ epoch: d.epoch, timestamp: d.timestamp, price: d.usdtSpent / d.pendleBought, pendle: d.pendleBought, usd: d.usdtSpent })),
    priceHistory: [...priceHistory.filter((p) => p.t < now - 3600), { t: now, price }],
    epochsUsed: complete.length,
    distributionsUsed: recent.length,
  };
}
