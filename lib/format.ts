const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export const fmtInt = (n: number) => int.format(n);

export const fmtCompact = (n: number) => compact.format(n);

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
