/**
 * The metrics each multi-series chart draws, in legend order. One per chart is `locked`: the
 * metric the chart exists to show, always drawn and not toggleable. The rest can be hidden from the
 * legend. Colours are the chart CSS variables so light and dark themes both hold.
 */
export type SeriesShape = "bar" | "area" | "line" | "dashed";

export type SeriesDef = {
  key: string;
  label: string;
  /** CSS colour, usually `var(--spendle)` etc. */
  color: string;
  shape: SeriesShape;
  /** Always drawn; the legend shows it as fixed. */
  locked?: boolean;
};

const SPENDLE = "var(--spendle)";
const VEPENDLE = "var(--vependle)";
const BOOST = "var(--boost)";
const TREASURY = "var(--chart-4)";
const LP = "var(--chart-lp)";
const FOREGROUND = "var(--foreground)";

/** Projected virtual sPENDLE: stacked 1× base and boost premium, with today's sPENDLE as a rule. */
export const DECAY_SERIES: SeriesDef[] = [
  { key: "locked", label: "1× base", color: VEPENDLE, shape: "area", locked: true },
  { key: "premium", label: "boost premium", color: BOOST, shape: "area" },
  { key: "sPendle", label: "sPENDLE today", color: SPENDLE, shape: "dashed" },
];

/** Projected dilution and plain APR. */
export const DILUTION_SERIES: SeriesDef[] = [
  { key: "dilutionFlat", label: "dilution, sPENDLE flat", color: BOOST, shape: "line", locked: true },
  { key: "dilutionRestake", label: "dilution, unlocks restaked", color: VEPENDLE, shape: "dashed" },
  { key: "aprPlainFlat", label: "plain APR, right axis", color: SPENDLE, shape: "line" },
];

/** Fees per epoch: non-swap stacked on swap. */
export const EPOCH_FEE_SERIES: SeriesDef[] = [
  { key: "yt", label: "YT and other", color: SPENDLE, shape: "area", locked: true },
  { key: "swap", label: "swap", color: VEPENDLE, shape: "area" },
];

/** Cumulative fee split, buyback funding, and LP emissions. */
export const ACCRUAL_SERIES: SeriesDef[] = [
  { key: "buyback", label: "80% share", color: SPENDLE, shape: "area", locked: true },
  { key: "buybackFunded", label: "funded", color: FOREGROUND, shape: "line" },
  { key: "treasury", label: "treasury", color: TREASURY, shape: "area" },
  { key: "ops", label: "ops", color: BOOST, shape: "area" },
  { key: "lp", label: "LP fees", color: LP, shape: "area" },
  { key: "emittedPendle", label: "LP emissions, right axis", color: BOOST, shape: "dashed" },
];

/** vePENDLE → sPENDLE by week. */
export const MIGRATION_SERIES: SeriesDef[] = [
  { key: "restaked", label: "restaked within 30 d", color: SPENDLE, shape: "bar", locked: true },
  { key: "notRestaked", label: "not restaked", color: VEPENDLE, shape: "bar" },
  { key: "vePendle", label: "PENDLE in vePENDLE", color: VEPENDLE, shape: "line" },
  { key: "sPendle", label: "sPENDLE supply", color: SPENDLE, shape: "line" },
];

/** Weekly staking flows and the cooldown queue. */
export const FLOWS_SERIES: SeriesDef[] = [
  { key: "staked", label: "staked", color: SPENDLE, shape: "bar", locked: true },
  { key: "cooldown", label: "to cooldown", color: VEPENDLE, shape: "bar" },
  { key: "instant", label: "instant, fee paid", color: BOOST, shape: "bar" },
  { key: "queue", label: "cooldown queue", color: FOREGROUND, shape: "line" },
];

/** Locked PENDLE over time under the live and snapshot schedules. */
export const UNLOCK_SERIES: SeriesDef[] = [
  { key: "live", label: "live schedule", color: VEPENDLE, shape: "line", locked: true },
  { key: "snapshot", label: "snapshot schedule", color: BOOST, shape: "dashed" },
];

/** What each buyback paid per PENDLE against the market. */
export const BUYBACK_PRICE_SERIES: SeriesDef[] = [
  { key: "paid", label: "paid per PENDLE", color: FOREGROUND, shape: "line", locked: true },
  { key: "usd", label: "USDT spent", color: SPENDLE, shape: "bar" },
  { key: "market", label: "PENDLE price, daily", color: BOOST, shape: "line" },
];
