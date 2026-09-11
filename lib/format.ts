const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export const fmtInt = (n: number) => int.format(n);

export const fmtNum = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const fmtUsd = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

/** Spot quote for PENDLE itself. */
export const fmtUsdPrice = (n: number) => fmtUsd(n, 3);

export const usdOf = (qty: number, price: number, digits = 0) => fmtUsd(qty * price, digits);

export const fmtCompact = (n: number) => compact.format(n);

export const fmtUsdCompact = (n: number) => `$${compact.format(n)}`;

export const fmtPct = (x: number, digits = 2) => `${(x * 100).toFixed(digits)}%`;

export const fmtMult = (m: number, digits = 2) => `${m.toFixed(digits)}×`;

export function fmtDate(ts: number, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  });
}

export function fmtDateTime(ts: number) {
  return `${new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export const fmtDays = (d: number) => `${Math.round(d)} d`;

export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
